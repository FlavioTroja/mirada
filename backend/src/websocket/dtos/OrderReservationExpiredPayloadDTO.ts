import { z } from "zod";

/**
 * Payload of `Events.ORDER_RESERVATION_EXPIRED` (backend-brief §3.9, §4.11).
 *
 * Sent with `sendToUser` to the **buyer**, and to nobody else: the lapsed hold is
 * their problem to act on, and the organization already learns that the counters
 * moved from `event/availability-changed`.
 *
 * Like every keijo push it is a **refetch trigger**, not a data channel: the two
 * ids are what the cart page needs to know *which* order stopped being held.
 * Shape declared by §3.9 as `{ orderId, eventId }`.
 */
export const OrderReservationExpiredPayloadSchema = z.object({
    orderId: z.number().int(),
    eventId: z.number().int(),
});

export type OrderReservationExpiredPayloadDTO = z.infer<typeof OrderReservationExpiredPayloadSchema>;
