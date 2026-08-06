/**
 * Central registry of every WebSocket event name the backend pushes to the frontend.
 * Keep ALL event strings here — never inline them in services. Namespaced
 * `<domain>/<action>` style, mirroring `@mqtt/topics/Topics`.
 */
export const Events = {
    /** Sent by the server right after a client authenticates its connection. */
    SYSTEM_WELCOME: "system/welcome",
    /** A Log row was saved and its recipients must be notified live. */
    LOG_NOTIFICATION: "log/notification",
    /**
     * The capacity counters of an event moved (commit or release). Notification and
     * refetch trigger, never a data channel: the frontend re-calls the REST endpoint.
     * Aggregated over a ~1.5s window by `AvailabilityBroadcastService` (backend-brief §3.9).
     */
    EVENT_AVAILABILITY_CHANGED: "event/availability-changed",
    /** A registration entered the event — the organizer's dashboard must refetch (§4.10). */
    REGISTRATION_CREATED: "registration/created",
    /**
     * A ticket changed holder (§4.12). Sent to BOTH parties and to the organization
     * members: the old holder's QR stops opening the door, the new holder's starts.
     */
    TICKET_TRANSFERRED: "ticket/transferred",
    /**
     * Somebody entered a session (§4.13). **Immediate, never aggregated**: this is the
     * live presence counter, and a safety figure that arrives late is a wrong figure.
     */
    CHECKIN_REGISTERED: "checkin/registered",
    /**
     * The 15-minute hold of an order lapsed and the scheduler released it (§4.11,
     * `RF-PAY-24`). Sent to the BUYER — nobody else has anything to do about it.
     * The buyer's cart page must stop counting down and say why, instead of letting
     * the user pay for seats that are no longer held.
     */
    ORDER_RESERVATION_EXPIRED: "order/reservation-expired",
    /**
     * An order was paid (§4.11). Sent to the BUYER. In phase D2 it is the Stripe
     * webhook that publishes it; today `POST /orders/:id/confirm-free` does, on the
     * very same code path minus the adapter.
     */
    PAYMENT_SUCCEEDED: "payment/succeeded",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
