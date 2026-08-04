import { z } from "zod";
import { TicketTypeSessionSchema } from "@prisma-gen/zod";
import { withToBeDisconnected } from "@utils/helpers/schemaTransformers";

/**
 * Sub-risorsa `PATCH /ticket-types/:id/sessions` (§3.2, nota 1 del §3.10):
 * UN SOLO endpoint che porta l'array intero — `id: -1` per le righe nuove,
 * `toBeDisconnected: true` per quelle da rimuovere.
 */
export const TicketTypeSessionUpdateSchema = withToBeDisconnected(
    TicketTypeSessionSchema.omit({ ticketTypeId: true, createdAt: true, updatedAt: true })
).array();

export type TicketTypeSessionUpdateDTO = z.infer<typeof TicketTypeSessionUpdateSchema>;
