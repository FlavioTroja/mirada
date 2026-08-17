import { MailLocale } from "@mail/ports/Mailer";

/**
 * Formattazione per le email. Pura, senza I/O, senza dipendenze dal dominio.
 *
 * ── Perché il fuso è esplicito ───────────────────────────────────────────────
 * Le date arrivano da Postgres in UTC. Un server che gira in UTC — cioè
 * praticamente ogni contenitore in produzione — formatterebbe «Milonga alle
 * 21:30» come «19:30», e il ballerino si presenterebbe due ore prima. Il fuso di
 * riferimento del prodotto è `Europe/Rome`, lo stesso che il frontend usa in
 * `core/i18n/format.ts`, e qui va detto a voce perché nessuno lo eredita.
 */
const TIMEZONE = process.env.TIMEZONE ?? "Europe/Rome";

const localeTag = (locale: MailLocale) => (locale === "en" ? "en-GB" : "it-IT");

/** «14 giugno 2027» — data lunga, senza ora. */
export function formatDate(value: Date, locale: MailLocale = "it"): string {
    return new Intl.DateTimeFormat(localeTag(locale), {
        timeZone: TIMEZONE,
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(value);
}

/** «14 giugno 2027, 21:30» — quando l'ora conta. */
export function formatDateTime(value: Date, locale: MailLocale = "it"): string {
    return new Intl.DateTimeFormat(localeTag(locale), {
        timeZone: TIMEZONE,
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(value);
}

/**
 * Il periodo di un evento.
 *
 * Un festival di quattro settimane e una milonga di una sera sono lo stesso
 * dato con due letture diverse: «dal 14 giugno all'11 luglio 2027» contro
 * «14 giugno 2027, 21:30». Scrivere sempre l'intervallo su un evento che dura
 * una sera produce «dal 14 giugno 2027 al 14 giugno 2027», che è rumore.
 */
export function formatEventDates(startAt: Date, endAt: Date, locale: MailLocale = "it"): string {
    const sameDay =
        new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(startAt) ===
        new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(endAt);

    if (sameDay) return formatDateTime(startAt, locale);

    return locale === "en"
        ? `${formatDate(startAt, locale)} – ${formatDate(endAt, locale)}`
        : `dal ${formatDate(startAt, locale)} al ${formatDate(endAt, locale)}`;
}
