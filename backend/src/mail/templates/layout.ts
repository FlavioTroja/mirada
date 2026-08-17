import { MailLocale } from "@mail/ports/Mailer";

/**
 * **L'involucro comune di ogni email**, e le ragioni per cui è fatto così.
 *
 * ── Perché tabelle e stili in linea, nel 2026 ────────────────────────────────
 * Outlook su Windows disegna l'HTML con il motore di Word, che non conosce
 * `flex`, `grid` né i fogli di stile esterni. Chi scrive email con il CSS
 * moderno ottiene un layout perfetto in prova e una colonna sfasciata sul
 * client che l'ufficio dell'organizzatore usa davvero. Le tabelle sono brutte
 * da scrivere e sono l'unica cosa che arriva uguale ovunque.
 *
 * ── Perché i colori sono cablati e non vengono dal tema ──────────────────────
 * Nelle email le variabili CSS non esistono: `var(--accent-rgb)` non si risolve
 * in nessun client. La palette è la stessa del prodotto, riscritta qui in
 * esadecimale — è l'unico posto del progetto dove la duplicazione è corretta.
 *
 * ── Perché `background-color` e non `background` ─────────────────────────────
 * Il controllo di compatibilità dava la forma abbreviata al 56% di supporto
 * contro il 94% della proprietà estesa: Outlook, che disegna con il motore di
 * Word, la ignora e lascia il fondo bianco — con sopra il testo avorio del tema.
 * È lo stesso difetto dei chip dei filtri, in un altro contesto.
 *
 * ── Perché nessuna immagine remota ───────────────────────────────────────────
 * Quasi tutti i client bloccano le immagini finché l'utente non le sblocca. Un
 * biglietto la cui informazione vive dentro un'immagine è un biglietto che non
 * si legge. Qui il contenuto è testo; il QR sta nell'area personale e nel PDF.
 */

const BRAND = {
    black: "#0F0A0C",
    surface: "#201015",
    ivory: "#F3E9DC",
    gold: "#E0B84F",
    muted: "#B9AFA6",
};

export interface LayoutInput {
    locale: MailLocale;
    /** Titolo grande in cima al corpo. */
    heading: string;
    /** Blocchi di testo: ognuno diventa un paragrafo. */
    paragraphs: string[];
    /** Righe di dettaglio in evidenza — «Evento», «Data», «Codice». */
    facts?: { label: string; value: string }[];
    /** Invito all'azione, quando c'è qualcosa da fare. */
    action?: { label: string; url: string };
    /** Chiusa aggiuntiva, sotto la firma. */
    footnote?: string;
}

const FOOTER: Record<MailLocale, string> = {
    it:
        "Questa è una comunicazione di servizio legata a una tua iscrizione: "
        + "la ricevi perché riguarda un ordine o un biglietto, non per scelte pubblicitarie.",
    en:
        "This is a service message about your registration: you are receiving it because it "
        + "concerns an order or a ticket, not for marketing reasons.",
};

/** Il sito pubblico, per i link. Configurabile perché in sviluppo non è il dominio vero. */
function publicUrl(): string {
    return (process.env.PUBLIC_URL ?? "https://mirada.dance").replace(/\/+$/, "");
}

const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderHtml(input: LayoutInput): string {
    const facts = (input.facts ?? [])
        .map(
            f => `
        <tr>
          <td style="padding:4px 12px 4px 0;color:${BRAND.muted};font-size:14px;white-space:nowrap;">${escapeHtml(f.label)}</td>
          <td style="padding:4px 0;color:${BRAND.ivory};font-size:14px;font-weight:600;">${escapeHtml(f.value)}</td>
        </tr>`,
        )
        .join("");

    const action = input.action
        ? `
      <tr><td style="padding:24px 0 0;">
        <a href="${escapeHtml(input.action.url)}"
           style="display:inline-block;background-color:${BRAND.gold};color:${BRAND.black};
                  text-decoration:none;font-weight:600;font-size:15px;
                  padding:12px 22px;border-radius:999px;">${escapeHtml(input.action.label)}</a>
      </td></tr>`
        : "";

    return `<!doctype html>
<html lang="${input.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${BRAND.black};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.black};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background-color:${BRAND.surface};border-radius:14px;padding:32px;">
        <tr><td style="color:${BRAND.gold};font-size:14px;letter-spacing:0.08em;
                       text-transform:uppercase;font-weight:600;padding-bottom:18px;">Mirada</td></tr>
        <tr><td style="color:${BRAND.ivory};font-size:22px;font-weight:600;line-height:1.3;
                       padding-bottom:16px;">${escapeHtml(input.heading)}</td></tr>
        ${input.paragraphs
            .map(
                p =>
                    `<tr><td style="color:${BRAND.ivory};font-size:15px;line-height:1.65;padding-bottom:12px;">${escapeHtml(p)}</td></tr>`,
            )
            .join("")}
        ${facts ? `<tr><td style="padding:12px 0;"><table role="presentation" cellpadding="0" cellspacing="0">${facts}</table></td></tr>` : ""}
        ${action}
        ${
            input.footnote
                ? `<tr><td style="color:${BRAND.muted};font-size:13px;line-height:1.6;padding-top:20px;">${escapeHtml(input.footnote)}</td></tr>`
                : ""
        }
        <tr><td style="border-top:1px solid rgba(243,233,220,0.14);padding-top:18px;margin-top:8px;
                       color:${BRAND.muted};font-size:12px;line-height:1.6;">
          ${escapeHtml(FOOTER[input.locale])}<br>
          <a href="${publicUrl()}" style="color:${BRAND.gold};text-decoration:none;">mirada.dance</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * La versione testuale — **non un ripiego**. È quella che i filtri antispam
 * leggono per valutare il messaggio, e l'unica che arriva intatta a chi usa un
 * lettore di schermo o blocca l'HTML.
 */
export function renderText(input: LayoutInput): string {
    const parts = [`MIRADA`, "", input.heading, "", ...input.paragraphs];

    if (input.facts?.length) {
        parts.push("");
        for (const f of input.facts) parts.push(`${f.label}: ${f.value}`);
    }
    if (input.action) {
        parts.push("", `${input.action.label}: ${input.action.url}`);
    }
    if (input.footnote) parts.push("", input.footnote);

    parts.push("", "—", FOOTER[input.locale], publicUrl());
    return parts.join("\n");
}

export { publicUrl };
