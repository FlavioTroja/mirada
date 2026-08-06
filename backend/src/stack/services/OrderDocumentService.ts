import { Service } from "fastify-decorators";
import fs from "node:fs/promises";
import path from "node:path";
import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import httpErrors from "http-errors";
import { Event, Order, OrderLine } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { readI18nText } from "@utils/helpers/i18nText";
import { TicketDocumentService } from "@services/TicketDocumentService";

/** Cartella servita staticamente da `public/` (decisione D-K: file su disco locale). */
const RECEIPTS_DIR = "receipts";

/** Centesimi interi → euro, per il solo uso di stampa (§3.1). */
function euro(cents: number): string {
    return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * # La ricevuta d'ordine — `GET /api/orders/:id/receipt` (§3.7, `RF-PAY-12`)
 *
 * **Come il PDF del biglietto, non è un titolo fiscale**, e per la stessa
 * ragione: la piattaforma è *strumento di vendita, non intermediario fiscale*.
 * Da qui, in negativo:
 *
 * - **nessuna numerazione progressiva** — il documento porta l'id dell'ordine,
 *   che non è un progressivo di documento e non lo diventa;
 * - **nessuna dicitura fiscale**: niente «fattura», niente imponibile, niente
 *   IVA, niente aliquote;
 * - **la stessa dichiarazione in chiaro** del biglietto, riusata da
 *   `TicketDocumentService.FISCAL_DISCLAIMER` perché i due documenti non possono
 *   dire due cose diverse sulla stessa natura.
 *
 * ── L'unica cosa che questo documento dice in più del biglietto ──────────────
 * I **diritti di prevendita esposti come voce separata** (`RB1`, `RF-PAY-6`):
 * sono ricavo della piattaforma, pagati dal partecipante, e **non transitano mai
 * dall'organizzatore**. Tenerli dentro il totale senza nominarli renderebbe il
 * documento una descrizione falsa di chi ha incassato che cosa.
 */
@Service()
export class OrderDocumentService {
    private static readonly FONTS = {
        Helvetica: {
            normal: "Helvetica",
            bold: "Helvetica-Bold",
            italics: "Helvetica-Oblique",
            bolditalics: "Helvetica-BoldOblique",
        },
    };

    public async build(input: {
        order: Order;
        lines: OrderLine[];
        event: Event;
        organizationName: string;
        buyerLabel: string;
        labelForLine: (line: OrderLine) => string;
    }): Promise<{ url: string; filePath: string; size: number; filename: string }> {
        const { order, lines, event, organizationName, buyerLabel, labelForLine } = input;

        const body: unknown[][] = [
            [
                { text: "Voce", style: "th" },
                { text: "Q.tà", style: "th", alignment: "right" },
                { text: "Prezzo", style: "th", alignment: "right" },
                { text: "Prevendita", style: "th", alignment: "right" },
                { text: "Totale", style: "th", alignment: "right" },
            ],
            ...lines.map(line => [
                { text: labelForLine(line), style: "td" },
                { text: String(line.quantity), style: "td", alignment: "right" },
                { text: euro(line.unitPrice), style: "td", alignment: "right" },
                { text: euro(line.presaleRightsPerUnit), style: "td", alignment: "right" },
                { text: euro(line.lineTotal), style: "td", alignment: "right" },
            ]),
        ];

        const definition: TDocumentDefinitions = {
            defaultStyle: { font: "Helvetica", fontSize: 10 },
            pageMargins: [40, 48, 40, 48],
            info: {
                title: `Riepilogo d'ordine — ${readI18nText(event.title) ?? event.slug}`,
                subject: "Riepilogo d'ordine (non è un titolo fiscale)",
            },
            content: [
                { text: "Riepilogo d'ordine", style: "kicker" },
                { text: readI18nText(event.title) ?? event.slug, style: "title", margin: [0, 2, 0, 2] },
                { text: `Organizzato da ${organizationName}`, style: "muted", margin: [0, 0, 0, 14] },

                { text: "Acquirente", style: "label" },
                { text: buyerLabel, style: "value", margin: [0, 0, 0, 8] },
                { text: "Riferimento d'ordine", style: "label" },
                { text: `ORD-${order.id}`, style: "code", margin: [0, 0, 0, 14] },

                {
                    table: { headerRows: 1, widths: ["*", 40, 70, 70, 70], body: body as never },
                    layout: "lightHorizontalLines",
                },

                {
                    margin: [0, 14, 0, 0],
                    columns: [
                        { width: "*", text: "" },
                        {
                            width: 240,
                            table: {
                                widths: ["*", 80],
                                body: [
                                    [
                                        { text: "Totale organizzatore", style: "td" },
                                        { text: euro(order.subtotal), style: "td", alignment: "right" },
                                    ],
                                    // `RB1` — voce separata, sempre, prima del totale.
                                    [
                                        { text: "Diritti di prevendita", style: "td" },
                                        { text: euro(order.presaleRights), style: "td", alignment: "right" },
                                    ],
                                    [
                                        { text: "Totale pagato", style: "value" },
                                        { text: euro(order.total), style: "value", alignment: "right" },
                                    ],
                                ] as never,
                            },
                            layout: "lightHorizontalLines",
                        },
                    ],
                },

                {
                    text: "I diritti di prevendita sono un compenso della piattaforma, pagati dal partecipante "
                        + "e non incassati dall'organizzatore.",
                    style: "muted",
                    margin: [0, 12, 0, 0],
                },
                {
                    text: TicketDocumentService.FISCAL_DISCLAIMER,
                    style: "disclaimer",
                    margin: [0, 12, 0, 0],
                },
            ],
            styles: {
                kicker: { fontSize: 9, characterSpacing: 1, color: "#777777" },
                title: { fontSize: 18, bold: true },
                muted: { fontSize: 9, color: "#777777" },
                label: { fontSize: 8, color: "#777777", characterSpacing: 0.5 },
                value: { fontSize: 12, bold: true },
                code: { fontSize: 11, bold: true, characterSpacing: 1 },
                th: { fontSize: 8, bold: true, color: "#555555" },
                td: { fontSize: 10 },
                disclaimer: { fontSize: 8, color: "#555555", italics: true },
            },
        };

        const filename = `${event.slug}-ordine-${order.id}.pdf`;
        const buffer = await this.render(definition);
        const { url, filePath } = await this.write(filename, buffer);

        Log.info(
            `[OrderDocument Service]: order summary produced for order (id ${order.id}) at ${url} — `
            + `${buffer.length} byte(s), ${lines.length} line(s)`,
        );

        return { url, filePath, size: buffer.length, filename };
    }

    private render(definition: TDocumentDefinitions): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const printer = new PdfPrinter(OrderDocumentService.FONTS);
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
        const directory = path.join("public", RECEIPTS_DIR);
        const filePath = path.join(directory, filename);
        try {
            await fs.mkdir(directory, { recursive: true });
            await fs.writeFile(filePath, content, { mode: 0o644 });
        } catch (err: unknown) {
            Log.error(`[OrderDocument Service]: failed to write '${filePath}': ${err instanceof Error ? err.message : String(err)}`);
            throw new httpErrors.InternalServerError("Errore durante la scrittura del riepilogo d'ordine.");
        }
        return { url: `${process.env.DOMAIN_URL}/${RECEIPTS_DIR}/${filename}`, filePath };
    }
}
