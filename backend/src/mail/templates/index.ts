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
// 1-bis. Conferma dell'indirizzo — il tasto che sblocca l'iscrizione
// ═══════════════════════════════════════════════════════════════════════════

export interface ConfirmEmailInput {
    locale: MailLocale;
    firstName: string;
    /** Il link completo, gettone compreso: la composizione non è cosa del modello. */
    confirmUrl: string;
    /** Il titolo dell'evento da cui è partita l'iscrizione, quando c'è. */
    eventTitle?: string | null;
    /** Ore di validità del link — scritte nel testo perché il lettore possa regolarsi. */
    validForHours: number;
}

/**
 * **L'unica email che il destinatario deve agire per forza**, e per questo è
 * costruita al contrario delle altre: prima il tasto, poi le spiegazioni.
 *
 * Non porta il QR e non porta un codice d'ingresso, perché a questo punto non
 * esiste ancora nessun biglietto: il posto si prenota **dopo** il clic. Dirlo in
 * modo esplicito evita l'equivoco peggiore, cioè che qualcuno la archivi
 * credendo di essere già iscritto.
 */
export function confirmEmailMail(input: ConfirmEmailInput): Rendered {
    const { locale, firstName, confirmUrl, eventTitle, validForHours } = input;

    if (locale === "en") {
        return build("Confirm your email address", {
            locale,
            heading: "One tap and you are in.",
            paragraphs: [
                `${firstName}, tap the button below to confirm this address is yours.`,
                eventTitle
                    ? `Until you do, your place at ${eventTitle} is not booked: seats are held from the moment you confirm, not from now.`
                    : "Until you do, the account cannot be used to book a place.",
                `The link works for ${validForHours} hours. If it expires, ask for a new one from the registration page — nothing is lost.`,
            ],
            action: { label: "Confirm my address", url: confirmUrl },
            footnote:
                "If you did not sign up on Mirada, ignore this message: without this confirmation the account stays inactive and no one can use it.",
        });
    }

    return build("Conferma il tuo indirizzo email", {
        locale,
        heading: "Manca un tocco.",
        paragraphs: [
            `${firstName}, premi il tasto qui sotto per confermare che questo indirizzo è tuo.`,
            eventTitle
                ? `Finché non lo fai, il tuo posto a ${eventTitle} non è prenotato: i posti si fermano dal momento della conferma, non da adesso.`
                : "Finché non lo fai, l'account non può prenotare un posto.",
            `Il link vale ${validForHours} ore. Se scade non hai perso nulla: puoi chiederne un altro dalla pagina d'iscrizione.`,
        ],
        action: { label: "Conferma il mio indirizzo", url: confirmUrl },
        footnote:
            "Se non ti sei iscritto tu su Mirada, ignora questo messaggio: senza questa conferma l'account resta inattivo e nessuno può usarlo.",
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
    /**
     * I biglietti. `qrCid` è l'identificativo dell'immagine incorporata: quando
     * c'è, il QR compare nel corpo; quando manca — per esempio se la
     * generazione è fallita — resta il solo codice, e l'email vale comunque.
     */
    tickets: { code: string; holder: string; qrCid?: string }[];
    /**
     * Centesimi interi **realmente incassati**. Zero è un caso normale, non un
     * errore.
     */
    total: number;
    /**
     * Il **saldo ancora da versare al check-in**, in centesimi (`14` §8,
     * `RF-SAL-13`). Zero, che è la norma, quando non c'è nessun acconto.
     *
     * ── Perché senza questo campo l'email mentiva ───────────────────────────
     * Su una vendita con acconto `total` è la sola cifra incassata dal negozio —
     * €46,50 su un pacchetto da €155. Mostrarla come totale e tacere del resto
     * significa dire a qualcuno che ha pagato quando non ha finito di pagare, e
     * lasciargli scoprire il contrario alla porta: nel posto peggiore, davanti a
     * una fila, con un volontario che non può nemmeno spiegare la cifra.
     */
    balanceDue?: number;
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
    const balanceDue = input.balanceDue ?? 0;

    // Il QR ha già il codice scritto sotto: ripeterlo anche nell'elenco dei
    // dettagli sarebbe la stessa stringa due volte a mezzo centimetro di
    // distanza. I dettagli portano il codice **solo** quando il QR non c'è.
    const withQr = tickets.filter(t => t.qrCid);
    const ticketFacts = withQr.length
        ? []
        : tickets.map((t, i) => ({
            label: tickets.length > 1
                ? (locale === "en" ? `Ticket ${i + 1} · ${t.holder}` : `Biglietto ${i + 1} · ${t.holder}`)
                : (locale === "en" ? "Ticket code" : "Codice biglietto"),
            value: t.code,
        }));

    const qrCodes = withQr.map(t => ({
        cid: t.qrCid!,
        code: t.code,
        caption: tickets.length > 1 ? t.holder : undefined,
    }));

    if (locale === "en") {
        return build(`Your registration for ${eventTitle} is confirmed`, {
            locale,
            heading: "Registration confirmed.",
            paragraphs: [
                `${firstName}, your place at ${eventTitle} is secured.`,
                balanceDue > 0
                    ? `You paid a deposit of ${euro(total, locale)}. The remaining `
                        + `${euro(balanceDue, locale)} is due at check-in, at the box office.`
                    : total === 0
                        ? "Nothing was charged: this ticket type is free."
                        : `You paid ${euro(total, locale)}.`,
                withQr.length
                    ? (tickets.length > 1
                        ? "Show these QR codes at the entrance — one per person. If your mail app hides the images, the code written underneath works just as well."
                        : "Show this QR code at the entrance. If your mail app hides images, the code written underneath works just as well.")
                    : (tickets.length > 1
                        ? "Show the codes below at the entrance. Each one admits one person."
                        : "Show the code below at the entrance."),
            ],
            facts: [
                { label: "Event", value: eventTitle },
                { label: "When", value: eventDates },
                ...(venue ? [{ label: "Where", value: venue }] : []),
                ...(balanceDue > 0
                    ? [
                        { label: "Deposit paid", value: euro(total, locale) },
                        { label: "Balance due at check-in", value: euro(balanceDue, locale) },
                    ]
                    : []),
                ...ticketFacts,
            ],
            qrCodes,
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
            balanceDue > 0
                ? `Hai versato un acconto di ${euro(total, locale)}. Il saldo di `
                    + `${euro(balanceDue, locale)} si versa al check-in, alla cassa.`
                : total === 0
                    ? "Non è stato addebitato nulla: questo titolo d'ingresso è gratuito."
                    : `Hai pagato ${euro(total, locale)}.`,
            withQr.length
                ? (tickets.length > 1
                    ? "Mostra questi QR all'ingresso — uno per persona. Se il tuo programma di posta nasconde le immagini, il codice scritto sotto vale allo stesso modo."
                    : "Mostra questo QR all'ingresso. Se il tuo programma di posta nasconde le immagini, il codice scritto sotto vale allo stesso modo.")
                : (tickets.length > 1
                    ? "Presenta i codici qui sotto all'ingresso. Ognuno vale per una persona."
                    : "Presenta il codice qui sotto all'ingresso."),
        ],
        facts: [
            { label: "Evento", value: eventTitle },
            { label: "Quando", value: eventDates },
            ...(venue ? [{ label: "Dove", value: venue }] : []),
            ...(balanceDue > 0
                ? [
                    { label: "Acconto versato", value: euro(total, locale) },
                    { label: "Saldo da versare al check-in", value: euro(balanceDue, locale) },
                ]
                : []),
            ...ticketFacts,
        ],
        qrCodes,
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


// ═══════════════════════════════════════════════════════════════════════════
// Invito a entrare in un'organizzazione
// ═══════════════════════════════════════════════════════════════════════════

export interface OrganizationInvitationInput {
    locale: MailLocale;
    /** Il nome dell'organizzazione in cui si è invitati. */
    organizzazione: string;
    /** Il link completo, gettone compreso: la composizione non è cosa del modello. */
    inviteUrl: string;
    /** Giorni di validità — scritti nel testo perché il lettore possa regolarsi. */
    validForDays: number;
}

/**
 * L'invito a diventare titolare di un'organizzazione che esiste già.
 *
 * Dice **due** cose che non sono ovvie a chi la riceve, e che se taciute
 * producono entrambe una segnalazione: che il link è **personale** — vale solo
 * per l'indirizzo a cui è arrivato, quindi inoltrarlo non serve a nulla — e che
 * porta a diventare titolare, cioè a poter operare sui dati e sugli incassi di
 * quell'organizzazione. Un invito che non dichiara cosa concede è un invito che
 * qualcuno accetta senza sapere cosa sta accettando.
 */
export function organizationInvitationMail(input: OrganizationInvitationInput): Rendered {
    const { locale, organizzazione, inviteUrl, validForDays } = input;

    if (locale === "en") {
        return build(`You have been invited to ${organizzazione}`, {
            locale,
            heading: "An organization is waiting for you.",
            paragraphs: [
                `You have been invited to join ${organizzazione} on Mirada as an owner: you will be able to create events, manage registrations and see the takings.`,
                "Tap the button below and sign in. If you do not have an account yet, you will create one along the way.",
                `The link works for ${validForDays} days and only for this email address: forwarding it to someone else will not let them in.`,
            ],
            action: { label: "Accept the invitation", url: inviteUrl },
            footnote:
                "If you were not expecting this, ignore the message: without your confirmation nothing happens, and whoever invited you can revoke it at any time.",
        });
    }

    return build(`Sei stato invitato in ${organizzazione}`, {
        locale,
        heading: "C'è un'organizzazione che ti aspetta.",
        paragraphs: [
            `Sei stato invitato a entrare in ${organizzazione} su Mirada come titolare: potrai creare eventi, seguire le iscrizioni e vedere gli incassi.`,
            "Premi il tasto qui sotto e accedi. Se non hai ancora un account, lo crei strada facendo.",
            `Il link vale ${validForDays} giorni e soltanto per questo indirizzo email: inoltrarlo a qualcun altro non gli permetterà di entrare.`,
        ],
        action: { label: "Accetta l'invito", url: inviteUrl },
        footnote:
            "Se non te lo aspettavi, ignora il messaggio: senza la tua conferma non succede nulla, e chi ti ha invitato può revocarlo in qualsiasi momento.",
    });
}
