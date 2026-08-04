import { z } from "zod";

/**
 * Payload of `Events.EVENT_AVAILABILITY_CHANGED` (backend-brief §3.9).
 *
 * **Notification and refetch trigger, not a domain data channel**: it carries the
 * minimum needed to decide *whether* to reload and *what* — the receiver re-calls
 * the REST endpoint. Counters deliberately do NOT travel here: a stale frame must
 * never be able to contradict the database.
 *
 * Targeting is `sendToUser` to every active member of the organization, never
 * `broadcastToRoles`: a role broadcast would deliver one organization's signals to
 * every `OWNER` on the platform, which is exactly the isolation the product must
 * guarantee (§1.5, §3.9).
 */
export const EventAvailabilityChangedPayloadSchema = z.object({
    eventId: z.number().int(),
    organizationId: z.number().int(),
});

export type EventAvailabilityChangedPayloadDTO = z.infer<typeof EventAvailabilityChangedPayloadSchema>;
