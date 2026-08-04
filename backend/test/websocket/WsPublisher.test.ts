import { config } from "dotenv";
config({ path: ".env.test" });

import http from "http";
import WebSocket from "ws";
import { RoleName } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { initializeWebSocketServer, closeWebSocketServer } from "@websocket/server/WebSocketServer";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { EventEnvelope, EventEnvelopeSchema } from "@websocket/dtos/EventEnvelope";
import { WelcomePayloadSchema } from "@websocket/dtos/WelcomePayloadDTO";
import { LogNotificationPayloadSchema } from "@websocket/dtos/LogNotificationPayloadDTO";

/**
 * End-to-end test of the WebSocket push module over a REAL socket: a dedicated HTTP
 * server (ephemeral port) gets the WSS attached in THIS module context, real `ws`
 * clients authenticate with seeded users' wsCodes, and the publisher's frames are
 * asserted on the wire. No mocks.
 */
describe("WebSocket push (connect + publish)", () => {
    const GOD_WS_CODE = "ws-test-god";
    const USER_WS_CODE = "ws-test-user";

    let httpServer: http.Server;
    let port: number;
    let publisher: WsPublisherService;
    let godClient: WebSocket;
    let userClient: WebSocket;
    let godFrames: ReturnType<typeof frameQueue>;
    let userFrames: ReturnType<typeof frameQueue>;

    /** Buffers every received frame so tests can await them one by one without races. */
    function frameQueue(client: WebSocket) {
        const frames: string[] = [];
        const waiters: ((frame: string) => void)[] = [];
        client.on("message", data => {
            const frame = data.toString();
            const waiter = waiters.shift();
            if (waiter) waiter(frame);
            else frames.push(frame);
        });
        return {
            next(timeoutMs = 5_000): Promise<string> {
                const buffered = frames.shift();
                if (buffered) return Promise.resolve(buffered);
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error("timed out waiting for a frame")), timeoutMs);
                    waiters.push(frame => {
                        clearTimeout(timer);
                        resolve(frame);
                    });
                });
            },
        };
    }

    function connect(wsCode: string): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            const client = new WebSocket(`ws://localhost:${port}/${wsCode}`);
            client.once("open", () => resolve(client));
            client.once("error", reject);
        });
    }

    beforeAll(async () => {
        // Give the seeded users a known wsCode so the connection auth can resolve them.
        await getPrismaClient().user.updateMany({ where: { username: "god" }, data: { wsCode: GOD_WS_CODE } });
        await getPrismaClient().user.updateMany({ where: { username: "user" }, data: { wsCode: USER_WS_CODE } });

        // WSS attached in this module context, so the publisher singleton sees it.
        httpServer = http.createServer();
        initializeWebSocketServer(httpServer);
        await new Promise<void>(resolve => httpServer.listen(0, "localhost", () => resolve()));
        port = (httpServer.address() as { port: number }).port;

        publisher = new WsPublisherService();

        godClient = await connect(GOD_WS_CODE);
        godFrames = frameQueue(godClient);
        userClient = await connect(USER_WS_CODE);
        userFrames = frameQueue(userClient);
    });

    afterAll(async () => {
        godClient?.close();
        userClient?.close();
        closeWebSocketServer();
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
    });

    it("welcomes an authenticated client with a typed system/welcome envelope", async () => {
        const envelope = EventEnvelopeSchema.parse(JSON.parse(await godFrames.next()));

        expect(envelope.event).toBe(Events.SYSTEM_WELCOME);
        expect(envelope.messageId.length).toBeGreaterThan(0);
        expect(typeof envelope.timestamp).toBe("string");
        expect(WelcomePayloadSchema.parse(envelope.payload).wsCode).toBe(GOD_WS_CODE);

        // Drain the user client's welcome too, so later tests start from a clean queue.
        const userWelcome = EventEnvelopeSchema.parse(JSON.parse(await userFrames.next()));
        expect(userWelcome.event).toBe(Events.SYSTEM_WELCOME);
    });

    it("sendToUsers reaches only the targeted wsCode with the returned envelope", async () => {
        const returned = await publisher.sendToUsers([GOD_WS_CODE], Events.LOG_NOTIFICATION, {
            level: "INFO",
            message: "hello god",
        });

        const received = JSON.parse(await godFrames.next()) as EventEnvelope;
        expect(received.messageId).toBe(returned.messageId);
        expect(received.event).toBe(Events.LOG_NOTIFICATION);
        expect(LogNotificationPayloadSchema.parse(received.payload).message).toBe("hello god");

        // The non-targeted client must NOT have received it: broadcast a marker and
        // assert the marker is the very next frame in its queue.
        const marker = await publisher.broadcastAll(Events.LOG_NOTIFICATION, { level: "INFO", message: "marker" });
        const userNext = JSON.parse(await userFrames.next()) as EventEnvelope;
        expect(userNext.messageId).toBe(marker.messageId);
        // Drain the marker from the god client too.
        const godNext = JSON.parse(await godFrames.next()) as EventEnvelope;
        expect(godNext.messageId).toBe(marker.messageId);
    });

    it("broadcastToRoles reaches only clients holding one of the roles", async () => {
        const returned = await publisher.broadcastToRoles([RoleName.GOD], Events.LOG_NOTIFICATION, {
            level: "WARNING",
            message: "gods only",
        });

        const received = JSON.parse(await godFrames.next()) as EventEnvelope;
        expect(received.messageId).toBe(returned.messageId);

        // The USER-role client must skip it: the marker must be its next frame.
        const marker = await publisher.broadcastAll(Events.LOG_NOTIFICATION, { level: "INFO", message: "marker" });
        const userNext = JSON.parse(await userFrames.next()) as EventEnvelope;
        expect(userNext.messageId).toBe(marker.messageId);
        const godNext = JSON.parse(await godFrames.next()) as EventEnvelope;
        expect(godNext.messageId).toBe(marker.messageId);
    });

    it("closes a connection whose wsCode does not match any user", async () => {
        const intruder = await connect("no-such-code");
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("timed out waiting for the server to close the socket")), 5_000);
            intruder.once("close", () => {
                clearTimeout(timer);
                resolve();
            });
        });
    });
});
