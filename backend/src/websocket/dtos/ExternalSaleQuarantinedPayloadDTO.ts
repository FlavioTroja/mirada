import { z } from "zod";

/**
 * Payload of `Events.EXTERNAL_SALE_QUARANTINED` (fase E).
 *
 * The one phase-E event that asks for an action rather than refreshing a screen:
 * somebody paid on the shop and Mirada could not translate the sale. `reason` is
 * the Italian, human-readable sentence shown next to the button that fixes it —
 * it is deliberately part of the frame, because a notice that says only "a sale
 * is stuck" makes the recipient go looking for what everybody already knows.
 */
export const ExternalSaleQuarantinedPayloadSchema = z.object({
    externalSaleId: z.number().int(),
    salesChannelId: z.number().int(),
    channelLabel: z.string(),
    organizationId: z.number().int(),
    /** Nullo: se non si sa tradurre il prodotto, non si sa nemmeno quale evento sia. */
    eventId: z.number().int().nullable(),
    externalOrderNumber: z.string().nullable(),
    reason: z.string(),
});

export type ExternalSaleQuarantinedPayloadDTO = z.infer<typeof ExternalSaleQuarantinedPayloadSchema>;
