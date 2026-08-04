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
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
