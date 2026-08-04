import { z } from "zod";

/**
 * Transport envelope wrapping every WebSocket push (backend -> frontend). Mirrors the
 * MQTT MessageEnvelope but carries an `event` discriminator instead of a topic, since
 * all frames travel on the same socket. The `payload` is left as `unknown` here; each
 * event has its own payload schema in `@websocket/dtos`.
 */
export const EventEnvelopeSchema = z.object({
    messageId: z.string(),
    timestamp: z.string(),
    source: z.string().optional(),
    event: z.string(),
    payload: z.unknown(),
});

export type EventEnvelope<T = unknown> = Omit<z.infer<typeof EventEnvelopeSchema>, "payload"> & {
    payload: T;
};
