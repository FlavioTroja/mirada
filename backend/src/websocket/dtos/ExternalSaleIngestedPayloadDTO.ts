import { z } from "zod";

/**
 * Payload of `Events.EXTERNAL_SALE_INGESTED` (fase E).
 *
 * Same discipline as `EventAvailabilityChangedPayloadDTO`: **notification and
 * refetch trigger, never a data channel**. It carries what the dashboard needs to
 * decide *what* to reload and to name the source in the notice — no counters, no
 * money, no buyer contact details. A stale frame must never be able to contradict
 * the database, and a WebSocket frame is not the place for personal data.
 *
 * Targeting is `sendToUsers` over the members of the owning organization.
 */
export const ExternalSaleIngestedPayloadSchema = z.object({
    externalSaleId: z.number().int(),
    salesChannelId: z.number().int(),
    /** Come l'organizzatore chiama il negozio nel back-office. */
    channelLabel: z.string(),
    eventId: z.number().int(),
    organizationId: z.number().int(),
    /** Quante iscrizioni sono entrate con questa vendita. */
    seats: z.number().int(),
    /** Il numero dell'ordine sul negozio (`#1042`) — come si ritrova, se qualcuno telefona. */
    externalOrderNumber: z.string().nullable(),
});

export type ExternalSaleIngestedPayloadDTO = z.infer<typeof ExternalSaleIngestedPayloadSchema>;
