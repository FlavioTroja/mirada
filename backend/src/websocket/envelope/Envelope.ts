import { v4 as uuidv4 } from "uuid";
import { EventEnvelope } from "@websocket/dtos/EventEnvelope";
import { EventName } from "@websocket/events/Events";

/**
 * Pure helpers (no DI, no I/O) to build and serialize the outbound transport envelope.
 * The module is outbound-only, so there is no deserialize counterpart.
 */

export function buildEventEnvelope<T>(
    event: EventName,
    payload: T,
    opts?: { source?: string }
): EventEnvelope<T> {
    return {
        messageId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: opts?.source ?? process.env.WS_SOURCE_ID ?? "backoffice",
        event,
        payload,
    };
}

export function serializeEventEnvelope<T>(envelope: EventEnvelope<T>): string {
    return JSON.stringify(envelope);
}
