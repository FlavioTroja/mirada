import { z } from "zod";
import { TicketSchema, TicketTransferSchema } from "@prisma-gen/zod";

export const TicketTransferResponseSchema = TicketTransferSchema;
export type TicketTransferResponseDTO = z.infer<typeof TicketTransferResponseSchema>;

/**
 * Esito di `POST /tickets/:id/transfer`: il biglietto con il **QR nuovo** e la
 * riga di storico che porta il codice invalidato.
 *
 * `roleMoved` dice se la capienza si è mossa: il frontend lo usa per spiegare al
 * ballerino perché il trasferimento poteva fallire (`RF-TCK-7`).
 */
export const TicketTransferOutcomeSchema = z.object({
    ticket: TicketSchema,
    transfer: TicketTransferSchema,
    roleMoved: z.boolean(),
    requirementsRevaluated: z.number().int(),
});
export type TicketTransferOutcomeDTO = z.infer<typeof TicketTransferOutcomeSchema>;
