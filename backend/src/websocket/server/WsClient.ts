import WebSocket from "ws";
import { RoleName } from "@prisma/client";

/**
 * A connected frontend socket, enriched by the connection handler with the heartbeat
 * flag and the authenticated user's `wsCode` / roles (used by the publisher to target
 * pushes).
 */
export class WsClient extends WebSocket {
    isAlive?: boolean;
    code?: string;
    roles?: RoleName[];
}
