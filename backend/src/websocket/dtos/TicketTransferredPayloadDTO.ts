import { z } from "zod";

/**
 * `ticket/transferred` — backend-brief §3.9.
 *
 * Destinatari: **entrambe le parti e i membri dell'organizzazione**, uno per uno
 * con `sendToUser`. Il vecchio titolare deve sapere che il suo QR non apre più,
 * il nuovo che il suo esiste, l'organizzatore che la lista è cambiata.
 *
 * Notifica e trigger di refetch, mai un canale di dati di dominio: il payload
 * porta il minimo necessario a decidere *se* ricaricare e *cosa*.
 */
export const TicketTransferredPayloadSchema = z.object({
    ticketId: z.number().int(),
    eventId: z.number().int(),
});

export type TicketTransferredPayloadDTO = z.infer<typeof TicketTransferredPayloadSchema>;
