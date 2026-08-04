import WebSocket from "ws";
import { Service } from "fastify-decorators";
import { RoleName } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { getWebSocketServer } from "@websocket/server/WebSocketServer";
import { WsClient } from "@websocket/server/WsClient";
import { buildEventEnvelope, serializeEventEnvelope } from "@websocket/envelope/Envelope";
import { EventEnvelope } from "@websocket/dtos/EventEnvelope";
import { EventName } from "@websocket/events/Events";
import { EventPublisher } from "@websocket/ports/EventPublisher";

/**
 * WebSocket adapter for the outbound push port. The only place (besides `server/`) that
 * knows the events travel over the `ws` library. Business services inject this typed
 * through the `EventPublisher` contract.
 */
@Service()
export class WsPublisherService extends EventPublisher {
    public async sendToUser<T>(wsCode: string, event: EventName, payload: T): Promise<EventEnvelope<T>> {
        return this.sendToUsers([wsCode], event, payload);
    }

    public async sendToUsers<T>(wsCodes: string[], event: EventName, payload: T): Promise<EventEnvelope<T>> {
        return this.push(
            event,
            payload,
            client => !!client.code && wsCodes.includes(client.code),
            `to ${wsCodes.length} targeted wsCode(s)`
        );
    }

    public async broadcastAll<T>(event: EventName, payload: T): Promise<EventEnvelope<T>> {
        return this.push(event, payload, () => true, "to all clients");
    }

    public async broadcastToRoles<T>(roles: RoleName[], event: EventName, payload: T): Promise<EventEnvelope<T>> {
        return this.push(
            event,
            payload,
            client => !!client.roles?.some(role => roles.includes(role)),
            `to roles [${roles.join(", ")}]`
        );
    }

    /** Builds ONE envelope per logical push and fans it out to every matching open socket. */
    private async push<T>(
        event: EventName,
        payload: T,
        filter: (client: WsClient) => boolean,
        target: string
    ): Promise<EventEnvelope<T>> {
        const envelope = buildEventEnvelope(event, payload);
        const wss = getWebSocketServer();

        if (!wss) {
            Log.warn(`[WebSocket Publisher]: server not initialized — dropped '${event}' (${envelope.messageId}) ${target}`);
            return envelope;
        }

        const raw = serializeEventEnvelope(envelope);
        const sent: string[] = [];
        wss.clients.forEach((client: WsClient) => {
            if (client.readyState !== WebSocket.OPEN || !filter(client)) {
                return;
            }
            client.send(raw);
            if (client.code) {
                sent.push(client.code);
            }
        });

        Log.info(`[WebSocket Publisher]: sent '${event}' (${envelope.messageId}) ${target} — reached ${sent.length} client(s) [${sent.join(", ")}]`);
        return envelope;
    }
}
