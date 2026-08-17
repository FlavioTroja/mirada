import { MailLocale, OutgoingMail } from "@mail/ports/Mailer";
import { LayoutInput, publicUrl, renderHtml, renderText } from "@mail/templates/layout";

/**
 * **I modelli delle email transazionali** — `RF-COM-1`, in italiano e in inglese
 * (`RF-COM-6`).
 *
 * Ogni modello è una funzione pura: prende i dati, restituisce oggetto, HTML e
 * testo. Non legge dal database, non decide a chi spedire, non spedisce. Così si
 * possono provare senza un server di posta e senza una transazione aperta.
 *
 * ── Sul tono ─────────────────────────────────────────────────────────────────
 * Queste email arrivano a un ballerino che ha appena speso dei soldi, o a cui è
 * appena scaduta una prenotazione. Dicono **cosa è successo e cosa succede
 * adesso**, in quest'ordine, senza entusiasmo di maniera. La riga più importante
 * di una conferma d'iscrizione non è «benvenuto»: è il codice del biglietto.
 */

type Rendered = Pick<OutgoingMail, "subject" | "html" | "text">;

function build(subject: string, layout: LayoutInput): Rendered {
    return { subject, html: renderHtml(layout), text: renderText(layout) };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Benvenuto — alla registrazione autonoma di un ballerino
// ═══════════════════════════════════════════════════════════════════════════

export interface WelcomeInput {
    locale: MailLocale;
    firstName: string;
    username: string;
}

export function welcomeMail(input: WelcomeInput): Rendered {
    const { locale, firstName, username } = input;

    if (locale === "en") {
        return build("Welcome to Mirada", {
            locale,
            heading: `Welcome, ${firstName}.`,
            paragraphs: [
                "Your account is ready. From now on your registrations, your tickets and their QR codes live here — you will not have to keep an email open to find them again.",
                "You do not need to do anything now: this message only confirms that the account exists.",
            ],
            facts: [{ label: "Username", value: username }],
            action: { label: "Browse the events", url: `${publicUrl()}/eventi` },
        });
    }

    return build("Benvenuto in Mirada", {
        locale,
        heading: `Benvenuto, ${firstName}.`,
        paragraphs: [
            "Il tuo account è pronto. Da adesso le tue iscrizioni, i tuoi biglietti e i loro QR vivono qui — non dovrai tenere aperta un'email per ritrovarli.",
            "Non devi fare nulla adesso: questo messaggio conferma soltanto che l'account esiste.",
        ],
        facts: [{ label: "Nome utente", value: username }],
        action: { label: "Guarda gli eventi", url: `${publicUrl()}/eventi` },
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Iscrizione confermata, con i biglietti
// ═══════════════════════════════════════════════════════════════════════════

export interface RegistrationConfirmedInput {
    locale: MailLocale;
    firstName: string;
    eventTitle: string;
    eventSlug: string;
    /** Periodo dell'evento già formattato: la formattazione è presentazione. */
    eventDates: string;
    venue: string | null;
    tickets: { code: string; holder: string }[];
    /** Centesimi interi. Zero è un caso normale, non un errore. */
    total: number;
}

/** Centesimi → «145,00 €». La formattazione vive qui, non nei dati. */
function euro(cents: number, locale: MailLocale): string {
    return new Intl.NumberFormat(locale === "en" ? "en-GB" : "it-IT", {
        style: "currency",
        currency: "EUR",
    }).format(cents / 100);
}

export function registrationConfirmedMail(input: RegistrationConfirmedInput): Rendered {
    const { locale, firstName, eventTitle, eventSlug, eventDates, venue, tickets, total } = input;
    const url = `${publicUrl()}/eventi/${eventSlug}`;

    const ticketFacts = tickets.map((t, i) => ({
        label: tickets.length > 1
            ? (locale === "en" ? `Ticket ${i + 1} · ${t.holder}` : `Biglietto ${i + 1} · ${t.holder}`)
            : (locale === "en" ? "Ticket code" : "Codice biglietto"),
        value: t.code,
    }));

    if (locale === "en") {
        return build(`Your registration for ${eventTitle} is confirmed`, {
            locale,
            heading: "Registration confirmed.",
            paragraphs: [
                `${firstName}, your place at ${eventTitle} is secured.`,
                total === 0
                    ? "Nothing was charged: this ticket type is free."
                    : `You paid ${euro(total, locale)}.`,
                tickets.length > 1
                    ? "Show the codes below at the entrance. Each one admits one person."
                    : "Show the code below at the entrance.",
            ],
            facts: [
                { label: "Event", value: eventTitle },
                { label: "When", value: eventDates },
                ...(venue ? [{ label: "Where", value: venue }] : []),
                ...ticketFacts,
            ],
            action: { label: "Open the event page", url },
            footnote:
                "This is an order confirmation with an entry code, not a fiscal document.",
        });
    }

    return build(`La tua iscrizione a ${eventTitle} è confermata`, {
        locale,
        heading: "Iscrizione confermata.",
        paragraphs: [
            `${firstName}, il tuo posto a ${eventTitle} è assicurato.`,
            total === 0
                ? "Non è stato addebitato nulla: questo titolo d'ingresso è gratuito."
                : `Hai pagato ${euro(total, locale)}.`,
            tickets.length > 1
                ? "Presenta i codici qui sotto all'ingresso. Ognuno vale per una persona."
                : "Presenta il codice qui sotto all'ingresso.",
        ],
        facts: [
            { label: "Evento", value: eventTitle },
            { label: "Quando", value: eventDates },
            ...(venue ? [{ label: "Dove", value: venue }] : []),
            ...ticketFacts,
        ],
        action: { label: "Apri la scheda dell'evento", url },
        footnote:
            "È una conferma d'ordine con codice d'accesso, non un titolo fiscale.",
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Prenotazione scaduta
// ═══════════════════════════════════════════════════════════════════════════

export interface ReservationExpiredInput {
    locale: MailLocale;
    firstName: string;
    eventTitle: string;
    eventSlug: string;
}

export function reservationExpiredMail(input: ReservationExpiredInput): Rendered {
    const { locale, firstName, eventTitle, eventSlug } = input;
    const url = `${publicUrl()}/eventi/${eventSlug}`;

    if (locale === "en") {
        return build(`Your reservation for ${eventTitle} has expired`, {
            locale,
            heading: "The fifteen minutes are over.",
            paragraphs: [
                `${firstName}, the seats you were holding for ${eventTitle} are available again to everyone.`,
                // Il punto di questa email: dire che NON è stato addebitato nulla.
                // È la prima domanda che si fa chi la riceve.
                "Nothing was charged. If you still want to go, start again — as long as there are seats, the reservation restarts from scratch.",
            ],
            action: { label: "Try again", url },
        });
    }

    return build(`La tua prenotazione per ${eventTitle} è scaduta`, {
        locale,
        heading: "I quindici minuti sono trascorsi.",
        paragraphs: [
            `${firstName}, i posti che tenevi per ${eventTitle} sono tornati disponibili per tutti.`,
            "Non è stato addebitato nulla. Se vuoi ancora andarci, rifai la richiesta: finché ci sono posti, la prenotazione riparte da capo.",
        ],
        action: { label: "Riprova l'iscrizione", url },
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Trasferimento del nominativo
// ═══════════════════════════════════════════════════════════════════════════

export interface TicketTransferredInput {
    locale: MailLocale;
    /** `holder` = chi riceve il biglietto; `previousHolder` = chi lo cede. */
    recipient: "new" | "previous";
    firstName: string;
    eventTitle: string;
    eventSlug: string;
    ticketCode: string;
    otherPartyName: string;
}

export function ticketTransferredMail(input: TicketTransferredInput): Rendered {
    const { locale, recipient, firstName, eventTitle, eventSlug, ticketCode, otherPartyName } = input;
    const url = `${publicUrl()}/eventi/${eventSlug}`;

    // Due messaggi diversi per lo stesso fatto: chi riceve deve sapere che ora
    // il biglietto è suo e con quale codice entra; chi cede deve sapere che il
    // suo non vale più. Mandare a entrambi lo stesso testo lascerebbe l'uno o
    // l'altro a presentarsi all'ingresso con un codice morto.
    if (recipient === "new") {
        if (locale === "en") {
            return build(`${otherPartyName} transferred a ticket to you`, {
                locale,
                heading: "The ticket is yours now.",
                paragraphs: [
                    `${firstName}, ${otherPartyName} transferred to you a ticket for ${eventTitle}.`,
                    "The code below is the one that admits you. The previous one no longer works.",
                ],
                facts: [
                    { label: "Event", value: eventTitle },
                    { label: "Ticket code", value: ticketCode },
                ],
                action: { label: "Open the event page", url },
            });
        }
        return build(`${otherPartyName} ti ha trasferito un biglietto`, {
            locale,
            heading: "Il biglietto è tuo.",
            paragraphs: [
                `${firstName}, ${otherPartyName} ti ha trasferito un biglietto per ${eventTitle}.`,
                "Il codice qui sotto è quello con cui entri. Il precedente non è più valido.",
            ],
            facts: [
                { label: "Evento", value: eventTitle },
                { label: "Codice biglietto", value: ticketCode },
            ],
            action: { label: "Apri la scheda dell'evento", url },
        });
    }

    if (locale === "en") {
        return build(`You transferred your ticket for ${eventTitle}`, {
            locale,
            heading: "Transfer completed.",
            paragraphs: [
                `${firstName}, your ticket for ${eventTitle} is now in ${otherPartyName}'s name.`,
                "Your previous code no longer admits anyone: do not present it at the entrance.",
            ],
            facts: [{ label: "Event", value: eventTitle }],
        });
    }
    return build(`Hai trasferito il tuo biglietto per ${eventTitle}`, {
        locale,
        heading: "Trasferimento completato.",
        paragraphs: [
            `${firstName}, il tuo biglietto per ${eventTitle} è ora intestato a ${otherPartyName}.`,
            "Il tuo codice precedente non fa più entrare nessuno: non presentarlo all'ingresso.",
        ],
        facts: [{ label: "Evento", value: eventTitle }],
    });
}
