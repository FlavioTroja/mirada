import { z } from "zod";

/**
 * Payload of `Events.PAYMENT_SUCCEEDED` (backend-brief §3.9, §4.11).
 *
 * Sent with `sendToUser` to the **buyer**. Shape declared by §3.9 as
 * `{ purchaseId, orderId }`: a refetch trigger, so the buyer's page reloads the
 * order and finds the tickets, rather than receiving them over the socket.
 *
 * In phase D2 the Stripe webhook publishes it on `payment_intent.succeeded`;
 * today `POST /orders/:id/confirm-free` publishes it on the very same code path,
 * minus the adapter. The frontend cannot and need not tell them apart.
 */
export const PaymentSucceededPayloadSchema = z.object({
    purchaseId: z.number().int(),
    orderId: z.number().int(),
});

export type PaymentSucceededPayloadDTO = z.infer<typeof PaymentSucceededPayloadSchema>;
