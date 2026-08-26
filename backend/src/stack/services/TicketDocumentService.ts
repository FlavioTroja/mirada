import { Service } from "fastify-decorators";
import fs from "node:fs/promises";
import path from "node:path";
import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import QRCode from "qrcode";
import httpErrors from "http-errors";
import { Event, Session, Ticket, TicketType } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { readI18nText } from "@utils/helpers/i18nText";

/** Cartella servita staticamente da `public/` (decisione D-K: file su disco locale). */
const TICKETS_DIR = "tickets";

/**
 * # Il documento del biglietto — `RF-TCK-11`
 *
 * È una **conferma d'ordine con QR di accesso, mai un titolo fiscale**, ed è una
 * delle **tre condizioni che reggono il posizionamento fiscale della
 * piattaforma**: non è una scelta di copywriting, è il motivo per cui la
 * piattaforma può dirsi *strumento di vendita e non intermediario fiscale*.
 *
 * Da qui discendono, in negativo, le regole di questo file:
 *
 * - **nessuna numerazione progressiva** — il documento porta il codice del
 *   biglietto, che è casuale e non ordinabile: un progressivo somiglia a un
 *   numero di documento e non deve esistere;
 * - **nessun sigillo, nessun logo di piattaforma in posizione di emittente**;
 * - **nessuna dicitura fiscale** — niente «ricevuta», «fattura», «corrispettivo»,
 *   niente imponibile, niente IVA, niente aliquote;
 * - **una dichiarazione esplicita in chiaro**, che dice al portatore che cosa ha
 *   in mano e chi è responsabile degli adempimenti.
 *
 * Il carattere è **Helvetica**, uno dei quattordici incorporati in ogni lettore
 * PDF: nessun file di font da spedire, nessuna dipendenza da `vfs_fonts`.
 */
@Service()
export class TicketDocumentService {
    private static readonly FONTS = {
        Helvetica: {
            normal: "Helvetica",
            bold: "Helvetica-Bold",
            italics: "Helvetica-Oblique",
            bolditalics: "Helvetica-BoldOblique",
        },
    };

    /** La dicitura che rende il documento ciò che è, e impedisce di scambiarlo per altro. */
    public static readonly FISCAL_DISCLAIMER =
        "Questo documento è una conferma d'ordine con codice di accesso. "
        + "Non è un titolo fiscale, non è una ricevuta e non è una fattura. "
        + "Gli adempimenti fiscali relativi all'evento sono a carico dell'organizzatore.";

    public async build(input: {
        ticket: Ticket;
        event: Event;
        ticketType: TicketType;
        sessions: Session[];
        qrToken: string;
        organizationName: string;
        /**
         * Il saldo ancora da versare al check-in, in centesimi (`14` §8,
         * `RF-SAL-13`). Zero, che è la norma, quando non c'è nessun acconto.
         *
         * ── Perché anche qui, e non solo nell'email ─────────────────────────
         * L'email si perde in fondo a una casella. Il PDF è ciò che la persona
         * ha materialmente in mano quando arriva alla porta, ed è lì che deve
         * poter leggere da sé che le manca ancora qualcosa da versare — invece
         * di sentirselo dire da un volontario che non può nemmeno dirle quanto.
         */
        balanceDue?: number;
    }): Promise<{ url: string; filePath: string; size: number; filename: string }> {
        const { ticket, event, ticketType, sessions, qrToken, organizationName } = input;
        const balanceDue = input.balanceDue ?? 0;

        // Il QR contiene il JWS firmato, non il codice nudo: ciò che si inquadra
        // deve essere verificabile senza rete (assunzione `AS-7`).
        const qrDataUrl = await QRCode.toDataURL(qrToken, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 480,
        });

        const definition: TDocumentDefinitions = {
            defaultStyle: { font: "Helvetica", fontSize: 10 },
            pageMargins: [40, 48, 40, 48],
            info: {
                title: `Conferma d'ordine — ${readI18nText(event.title) ?? event.slug}`,
                subject: "Conferma d'ordine con codice di accesso (non è un titolo fiscale)",
            },
            content: [
                { text: "Conferma d'ordine", style: "kicker" },
                { text: readI18nText(event.title) ?? event.slug, style: "title", margin: [0, 2, 0, 2] },
                { text: `Organizzato da ${organizationName}`, style: "muted", margin: [0, 0, 0, 14] },

                {
                    columns: [
                        {
                            width: "*",
                            stack: [
                                { text: "Titolare", style: "label" },
                                {
                                    text: ticket.bearer
                                        ? "Pass al portatore"
                                        : `${ticket.holderName} ${ticket.holderSurname}`,
                                    style: "value",
                                    margin: [0, 0, 0, 8],
                                },
                                { text: "Titolo d'ingresso", style: "label" },
                                { text: readI18nText(ticketType.name) ?? "—", style: "value", margin: [0, 0, 0, 8] },
                                { text: "Codice di accesso", style: "label" },
                                { text: ticket.code, style: "code", margin: [0, 0, 0, 8] },
                            ],
                        },
                        {
                            width: 150,
                            stack: [{ image: qrDataUrl, width: 150 }],
                        },
                    ],
                },

                ...(balanceDue > 0
                    ? [
                        {
                            text: "Saldo da versare al check-in",
                            style: "label",
                            margin: [0, 12, 0, 2] as [number, number, number, number],
                        },
                        {
                            text: `${(balanceDue / 100).toFixed(2).replace(".", ",")} €`,
                            style: "value",
                        },
                        {
                            text: "L'importo si versa alla cassa il giorno dell'evento. "
                                + "Il biglietto è valido: il saldo non condiziona l'ingresso.",
                            style: "muted",
                        },
                    ]
                    : []),

                { text: "Sessioni incluse", style: "label", margin: [0, 12, 0, 4] },
                sessions.length
                    ? {
                        ul: sessions.map(session =>
                            `${readI18nText(session.name) ?? "Sessione"} — `
                            + `${session.startAt.toISOString().slice(0, 16).replace("T", " ")}`
                            + (session.room ? ` · ${session.room}` : ""),
                        ),
                    }
                    : { text: "Nessuna sessione dichiarata.", style: "muted" },

                {
                    text: TicketDocumentService.FISCAL_DISCLAIMER,
                    style: "disclaimer",
                    margin: [0, 20, 0, 0],
                },
            ],
            styles: {
                kicker: { fontSize: 9, characterSpacing: 1, color: "#777777" },
                title: { fontSize: 18, bold: true },
                muted: { fontSize: 9, color: "#777777" },
                label: { fontSize: 8, color: "#777777", characterSpacing: 0.5 },
                value: { fontSize: 12, bold: true },
                code: { fontSize: 11, bold: true, characterSpacing: 1 },
                disclaimer: { fontSize: 8, color: "#555555", italics: true },
            },
        };

        const filename = `${event.slug}-${ticket.code}.pdf`;
        const buffer = await this.render(definition);
        const { url, filePath } = await this.write(filename, buffer);

        Log.info(
            `[TicketDocument Service]: order confirmation produced for ticket (id ${ticket.id}, code ${ticket.code}) `
            + `at ${url} — ${buffer.length} byte(s)`,
        );

        return { url, filePath, size: buffer.length, filename };
    }

    private render(definition: TDocumentDefinitions): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const printer = new PdfPrinter(TicketDocumentService.FONTS);
                const document = printer.createPdfKitDocument(definition);
                const chunks: Buffer[] = [];
                document.on("data", (chunk: Buffer) => chunks.push(chunk));
                document.on("end", () => resolve(Buffer.concat(chunks)));
                document.on("error", reject);
                document.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    private async write(filename: string, content: Buffer): Promise<{ url: string; filePath: string }> {
        const directory = path.join("public", TICKETS_DIR);
        const filePath = path.join(directory, filename);
        try {
            await fs.mkdir(directory, { recursive: true });
            await fs.writeFile(filePath, content, { mode: 0o644 });
        } catch (err: unknown) {
            Log.error(`[TicketDocument Service]: failed to write '${filePath}': ${err instanceof Error ? err.message : String(err)}`);
            throw new httpErrors.InternalServerError("Errore durante la scrittura della conferma d'ordine.");
        }
        return { url: `${process.env.DOMAIN_URL}/${TICKETS_DIR}/${filename}`, filePath };
    }
}
