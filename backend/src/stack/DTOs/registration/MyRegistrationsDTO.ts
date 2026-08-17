import { z } from "zod";

/**
 * `GET /registrations/mine` — **le iscrizioni di chi chiede**, per il sito pubblico.
 *
 * ── Perché una forma sua e non l'entità popolata ─────────────────────────────
 * Un `Registration` con `event` e `tickets` popolati porterebbe anche
 * `Ticket.code`: il contenuto del QR, cioè la cosa con cui si entra. Chi chiede
 * ne ha diritto — è il suo biglietto, e gli arriva pure per email — ma non c'è
 * ragione di farlo transitare a ogni apertura della pagina del profilo. Il
 * codice si chiede quando serve davvero, da `GET /tickets/:id/qr`, che risponde
 * con l'immagine e non con il contenuto firmato.
 *
 * Per lo stesso motivo qui non compaiono `orderLineId`, `passIssuanceId` né i
 * riferimenti interni: sono la contabilità dell'organizzatore, non l'informazione
 * di chi va a ballare.
 */
export const MyTicketSchema = z.object({
    id: z.number().int(),
    status: z.string(),
    /** Titolo d'ingresso: testo multilingua, reso dal client nella sua lingua. */
    ticketTypeName: z.any().nullable(),
    holderName: z.string(),
    holderSurname: z.string(),
    /** Pass al portatore: non ha un nome sopra, e non è trasferibile. */
    bearer: z.boolean(),
    /**
     * Falso quando il QR è stato revocato — rimborso, annullamento. Un
     * biglietto revocato resta visibile: sapere che non vale più è
     * un'informazione, farlo sparire è una sorpresa alla porta.
     */
    qrAvailable: z.boolean(),
});
export type MyTicketDTO = z.infer<typeof MyTicketSchema>;

export const MyRegistrationEventSchema = z.object({
    id: z.number().int(),
    slug: z.string(),
    title: z.any(),
    startAt: z.date().or(z.string()),
    endAt: z.date().or(z.string()),
    status: z.string(),
    venueName: z.string().nullable(),
    city: z.string().nullable(),
    /** Il ritaglio verticale della locandina, se c'è. */
    posterUrl: z.string().nullable(),
});

export const MyRegistrationSchema = z.object({
    id: z.number().int(),
    status: z.string(),
    declaredRole: z.string(),
    assignedRole: z.string().nullable(),
    confirmedAt: z.date().or(z.string()).nullable(),
    isMinor: z.boolean(),
    event: MyRegistrationEventSchema,
    tickets: MyTicketSchema.array(),
});
export type MyRegistrationDTO = z.infer<typeof MyRegistrationSchema>;

/**
 * Il taglio fra «prossimi» e «ci sei stato» è **del server**, e sulla data di
 * fine dell'evento: un festival cominciato ieri e che finisce domani è ancora
 * prossimo, non passato. Farlo decidere al client significherebbe la stessa
 * regola scritta due volte, e un fuso orario diverso il giorno dell'evento.
 */
export const MyRegistrationsSchema = z.object({
    upcoming: MyRegistrationSchema.array(),
    past: MyRegistrationSchema.array(),
});
export type MyRegistrationsDTO = z.infer<typeof MyRegistrationsSchema>;
