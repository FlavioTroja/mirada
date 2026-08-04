import WebSocket from "ws";
import http from "http";
import https from "https";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { UserWithRelations } from "@prisma-gen/zod";
import { WsClient } from "@websocket/server/WsClient";
import { Events } from "@websocket/events/Events";
import { buildEventEnvelope, serializeEventEnvelope } from "@websocket/envelope/Envelope";
import { WelcomePayloadDTO } from "@websocket/dtos/WelcomePayloadDTO";

/**
 * Long-lived WebSocket server singleton, attached to the HTTP(S) server. Mirrors the
 * `@mqtt/client/MqttClient` pattern (module-level `let`, `initialize*`, `get*`, `close*`).
 *
 * Connection auth: the client connects with its `wsCode` as the last URL path segment;
 * the handler resolves the user (direct Prisma — this is self-contained infrastructure,
 * not a DI service) and stores `code`/`roles` on the socket so the publisher can target
 * pushes. Unauthenticated sockets are closed immediately.
 */
let WSS: WebSocket.Server | undefined;
let heartbeat: NodeJS.Timeout | undefined;

const HEARTBEAT_INTERVAL_MS = 60_000;

export function initializeWebSocketServer(server: http.Server | https.Server): WebSocket.Server {
    WSS = createWebSocketServer(server);
    heartbeat = startHeartbeat(WSS);
    Log.info(`[WebSocket Server]: started — polling every ${HEARTBEAT_INTERVAL_MS / 1000}s to detect inactive clients`);
    return WSS;
}

export function getWebSocketServer(): WebSocket.Server | undefined {
    return WSS;
}

/** Stops the heartbeat; the WSS itself dies with the HTTP server it is attached to. */
export function closeWebSocketServer(): void {
    if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = undefined;
    }
    WSS = undefined;
}

function createWebSocketServer(server: http.Server | https.Server): WebSocket.Server {
    const wss = new WebSocket.Server({ server });

    wss.on("connection", async (ws: WsClient, req: http.IncomingMessage) => {
        ws.isAlive = true;
        ws.on("pong", () => {
            ws.isAlive = true;
            Log.debug(`[WebSocket Server]: client '${ws.code}' is still alive`);
        });

        ws.on("close", () => {
            Log.info(`[WebSocket Server]: client '${ws.code}' closed its connection`);
        });

        const wsCode = req.url?.substring(req.url.lastIndexOf("/") + 1);

        if (!wsCode) {
            Log.warn(`[WebSocket Server]: connection rejected — no wsCode in URL '${req.url}'`);
            ws.close();
            return;
        }

        const user = await getUserFromWsCode(wsCode);

        if (!user?.id) {
            Log.warn(`[WebSocket Server]: connection rejected — no user for wsCode '${wsCode}'`);
            ws.close();
            return;
        }

        ws.code = wsCode;
        ws.roles = user.roles.map(r => r.roleName);

        const welcome: WelcomePayloadDTO = {
            message: `Hello there! Your session ID is ${wsCode}.`,
            wsCode,
        };
        ws.send(serializeEventEnvelope(buildEventEnvelope(Events.SYSTEM_WELCOME, welcome)));
        Log.info(`[WebSocket Server]: client connected with wsCode '${ws.code}' and roles [${ws.roles?.join(", ")}]`);
    });

    return wss;
}

async function getUserFromWsCode(wsCode: string) {
    const users = getPrismaClient().user;

    return await users.findFirst({ where: { wsCode }, include: { roles: true } }) as unknown as UserWithRelations;
}

/** Pings every client periodically and terminates the ones that missed the last pong. */
function startHeartbeat(wss: WebSocket.Server): NodeJS.Timeout {
    const interval = setInterval(() => {
        wss.clients.forEach((ws: WsClient) => {
            if (!ws.isAlive) {
                Log.info(`[WebSocket Server]: client '${ws.code}' is dead — terminating`);
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, HEARTBEAT_INTERVAL_MS);
    // Don't let the heartbeat keep the process alive on its own (graceful shutdown, tests).
    interval.unref();
    return interval;
}
