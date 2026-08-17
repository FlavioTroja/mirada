import { Service } from "fastify-decorators";
import nodemailer, { Transporter } from "nodemailer";
import { Log } from "@utils/adapters/log";
import { Mailer, MailOutcome, OutgoingMail } from "@mail/ports/Mailer";

/**
 * **L'unico file del progetto che conosce `nodemailer`** — porte e adattatori,
 * come per il WebSocket.
 *
 * ── Due modi di funzionare, e nessuno dei due sorprende ──────────────────────
 * · Con `SMTP_HOST` impostato spedisce davvero. In sviluppo lo si punta a un
 *   raccoglitore locale (Mailpit, `docker compose up mailpit`) e le email si
 *   leggono nel browser esattamente come le riceverà un ballerino; in
 *   produzione al fornitore vero.
 * · **Senza `SMTP_HOST` non spedisce e non fallisce**: scrive il messaggio nel
 *   log e riferisce `sent: false`. È deliberato — chi clona il progetto e lo
 *   avvia deve poter iscrivere un ballerino senza prima configurare un server
 *   di posta, e deve *vedere* che un'email sarebbe partita invece di scoprirlo
 *   sei mesi dopo.
 *
 * ── Il trasporto si costruisce una volta sola ────────────────────────────────
 * `nodemailer` tiene un pool di connessioni: ricrearlo a ogni messaggio
 * aprirebbe una connessione TCP e una negoziazione TLS per ogni email, che
 * sulla conferma di un ordine con dieci partecipanti sono dieci strette di mano
 * invece di una.
 */
@Service()
export class SmtpMailer extends Mailer {
    private transporter: Transporter | null = null;
    private initialized = false;

    /**
     * Il mittente. **Un sottodominio, non il dominio principale**: se un giorno
     * la reputazione della posta si guasta, a rimetterci è `mail.mirada.dance`
     * e non il dominio su cui vivono il sito e i contatti.
     */
    private get from(): string {
        const address = process.env.MAIL_FROM ?? "biglietti@mail.mirada.dance";
        const name = process.env.MAIL_FROM_NAME ?? "Mirada";
        return `"${name}" <${address}>`;
    }

    private ensureTransport(): Transporter | null {
        if (this.initialized) return this.transporter;
        this.initialized = true;

        const host = process.env.SMTP_HOST;
        if (!host) {
            Log.warn(
                "[Smtp Mailer]: SMTP_HOST is not set — mail will be logged and NOT delivered. "
                + "Set SMTP_HOST/SMTP_PORT (dev: the local Mailpit on 1025) to actually send.",
            );
            return null;
        }

        const port = Number(process.env.SMTP_PORT ?? 587);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASSWORD;

        this.transporter = nodemailer.createTransport({
            host,
            port,
            // TLS implicito o STARTTLS, e la differenza non è un dettaglio:
            // sulla **465** la connessione è cifrata dal primo byte, sulla
            // **587** parte in chiaro e sale con STARTTLS. Invertire i due
            // valori fa fallire l'apertura, ed è l'errore di configurazione più
            // comune su questo trasporto.
            //
            // La regola di serie — «465 significa implicito» — copre OVH,
            // Gmail, SendGrid e la quasi totalità dei fornitori. `SMTP_SECURE`
            // esiste per il caso in cui non basti: un fornitore che offra il TLS
            // implicito su una porta diversa manderebbe altrimenti in errore una
            // configurazione per il resto corretta, senza dire perché.
            secure: process.env.SMTP_SECURE
                ? process.env.SMTP_SECURE === "true"
                : port === 465,
            auth: user && pass ? { user, pass } : undefined,
            pool: true,
            maxConnections: 3,
        });

        Log.info(`[Smtp Mailer]: transport ready on ${host}:${port}${user ? " (authenticated)" : ""}`);
        return this.transporter;
    }

    public describe(): string {
        const host = process.env.SMTP_HOST;
        return host ? `SMTP ${host}:${process.env.SMTP_PORT ?? 587}` : "solo log (SMTP_HOST non impostato)";
    }

    public async send(mail: OutgoingMail): Promise<MailOutcome> {
        const transport = this.ensureTransport();
        const to = mail.toName ? `"${mail.toName}" <${mail.to}>` : mail.to;

        if (!transport) {
            Log.info(
                `[Smtp Mailer]: NOT SENT (no transport) — to '${mail.to}', subject '${mail.subject}'`,
            );
            return { sent: false, error: "SMTP_HOST non impostato" };
        }

        try {
            const info = await transport.sendMail({
                from: this.from,
                to,
                subject: mail.subject,
                text: mail.text,
                html: mail.html,
                // `cid` collega l'allegato all'`<img src="cid:…">` del corpo:
                // è così che un QR arriva **dentro** il messaggio invece di
                // essere scaricato da un server e quindi bloccato.
                attachments: mail.inlineImages?.map(image => ({
                    cid: image.cid,
                    filename: image.filename,
                    content: image.content,
                    contentType: image.contentType,
                })),
            });
            Log.info(`[Smtp Mailer]: sent to '${mail.to}' — subject '${mail.subject}' (id ${info.messageId})`);
            return { sent: true, messageId: info.messageId };
        } catch (err) {
            // Si registra e si va avanti: il fatto che ha generato l'email è già
            // scritto, e non può essere annullato da un server di posta.
            const message = (err as Error).message;
            Log.error(`[Smtp Mailer]: FAILED to send to '${mail.to}' — subject '${mail.subject}': ${message}`);
            return { sent: false, error: message };
        }
    }
}
