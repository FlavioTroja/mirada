import { RoleName } from "@prisma/client";
import { EventEnvelope } from "@websocket/dtos/EventEnvelope";
import { EventName } from "@websocket/events/Events";

/**
 * Outbound WebSocket push PORT (backend -> frontend only, no acks). Business services
 * depend on this abstraction, never on the `ws` library nor on the concrete adapter.
 * Declared as an `abstract class` (not a bare interface) so it survives as a runtime
 * type and adapters can `extends` it — same pattern as `@mqtt/ports/MessagePublisher`.
 *
 * Every method wraps `payload` in an EventEnvelope and returns it, so callers can read
 * the generated `messageId`. One envelope per logical push, fanned out to N sockets.
 */
export abstract class EventPublisher {
    /** Push to the single client identified by `wsCode`. */
    abstract sendToUser<T>(wsCode: string, event: EventName, payload: T): Promise<EventEnvelope<T>>;

    /** Push to every connected client whose `wsCode` is in `wsCodes`. */
    abstract sendToUsers<T>(wsCodes: string[], event: EventName, payload: T): Promise<EventEnvelope<T>>;

    /** Push to every connected client. */
    abstract broadcastAll<T>(event: EventName, payload: T): Promise<EventEnvelope<T>>;

    /** Push to every connected client holding at least one of `roles`. */
    abstract broadcastToRoles<T>(roles: RoleName[], event: EventName, payload: T): Promise<EventEnvelope<T>>;
}
