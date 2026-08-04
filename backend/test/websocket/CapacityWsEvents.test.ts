import { config } from "dotenv";
config({ path: ".env.test" });

import http from "http";
import WebSocket from "ws";
import { DeclaredDanceRole, QuotaScope } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { closeWebSocketServer, initializeWebSocketServer } from "@websocket/server/WebSocketServer";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { EventEnvelope, EventEnvelopeSchema } from "@websocket/dtos/EventEnvelope";
import { EventAvailabilityChangedPayloadSchema } from "@websocket/dtos/EventAvailabilityChangedPayloadDTO";
import { AvailabilityBroadcastService } from "@services/AvailabilityBroadcastService";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";
import { OrganizationMemberRepository } from "@repositories/OrganizationMemberRepository";
import { UserRepository } from "@repositories/UserRepository";
import { createEventScenario, createQuota, createRegistration } from "../fixtures/capacity";

/**
 * `event/availability-changed` su un **socket reale** — backend-brief §3.9.
 *
 * Due proprietà che nessun test unitario può dimostrare e che qui si verificano
 * sul filo:
 *
 * 1. **Isolamento fra organizzazioni.** Il frame arriva ai membri
 *    dell'organizzazione proprietaria dell'evento e **a nessun altro**. Il §3.9
 *    vieta `broadcastToRoles` proprio per questo: un broadcast per ruolo farebbe
 *    arrivare a ogni `OWNER` della piattaforma i segnali delle organizzazioni
 *    altrui.
 * 2. **Aggregazione.** Molte variazioni nella finestra di ~1,5 s collassano in
 *    **un solo frame**: in apertura vendite i contatori si muovono decine di
 *    volte al secondo, e un frame per movimento trasformerebbe un segnale di
 *    refetch in una tempesta di refetch.
 */
describe("event/availability-changed — targeting e aggregazione su socket reale", () => {
    const MEMBER_WS_CODE = "ws-cap-member";
    const OUTSIDER_WS_CODE = "ws-cap-outsider";

    let httpServer: http.Server;
    let port: number;
    let broadcast: AvailabilityBroadcastService;
    let memberClient: WebSocket;
    let outsiderClient: WebSocket;
    let memberFrames: ReturnType<typeof frameQueue>;
    let outsiderFrames: ReturnType<typeof frameQueue>;
    let scenario: Awaited<ReturnType<typeof createEventScenario>>;

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
            next(timeoutMs = 8_000): Promise<string> {
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
            buffered: () => frames.length,
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
        const prisma = getPrismaClient();

        scenario = await createEventScenario();

        // 'god' è membro dell'organizzazione dell'evento; 'user' è estraneo.
        await prisma.user.updateMany({ where: { username: "god" }, data: { wsCode: MEMBER_WS_CODE } });
        await prisma.user.updateMany({ where: { username: "user" }, data: { wsCode: OUTSIDER_WS_CODE } });

        const member = await prisma.user.findFirstOrThrow({ where: { username: "god" } });
        await prisma.organizationMember.create({
            data: {
                organizationId: scenario.organizationId,
                userId: member.id,
                role: "OWNER",
                invitedAt: new Date(),
            },
        });

        httpServer = http.createServer();
        initializeWebSocketServer(httpServer);
        await new Promise<void>(resolve => httpServer.listen(0, "localhost", () => resolve()));
        port = (httpServer.address() as { port: number }).port;

        // Istanze costruite a mano perché la WSS singleton di questo modulo Jest
        // deve essere quella che il publisher vede (regola 9 di `testing.md`).
        const audience = new OrganizationAudienceService(new OrganizationMemberRepository(), new UserRepository());
        broadcast = new AvailabilityBroadcastService(new WsPublisherService(), audience);

        memberClient = await connect(MEMBER_WS_CODE);
        memberFrames = frameQueue(memberClient);
        outsiderClient = await connect(OUTSIDER_WS_CODE);
        outsiderFrames = frameQueue(outsiderClient);

        // Consuma i due `system/welcome`.
        await memberFrames.next();
        await outsiderFrames.next();
    });

    afterAll(async () => {
        memberClient?.close();
        outsiderClient?.close();
        closeWebSocketServer();
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
    });

    it("consegna il frame SOLO ai membri dell'organizzazione, mai in broadcast per ruolo", async () => {
        broadcast.notify(scenario.event.id, scenario.organizationId);
        expect(broadcast.pendingCount()).toBe(1);

        await broadcast.flush(scenario.event.id);

        const envelope = EventEnvelopeSchema.parse(JSON.parse(await memberFrames.next())) as EventEnvelope;
        expect(envelope.event).toBe(Events.EVENT_AVAILABILITY_CHANGED);

        const payload = EventAvailabilityChangedPayloadSchema.parse(envelope.payload);
        expect(payload).toEqual({ eventId: scenario.event.id, organizationId: scenario.organizationId });

        // L'estraneo non deve aver ricevuto nulla: nessun frame in coda.
        expect(outsiderFrames.buffered()).toBe(0);
    });

    it("aggrega più variazioni nella stessa finestra in UN SOLO frame", async () => {
        for (let i = 0; i < 25; i += 1) {
            broadcast.notify(scenario.event.id, scenario.organizationId);
        }
        // Venticinque variazioni, una sola finestra aperta.
        expect(broadcast.pendingCount()).toBe(1);

        await broadcast.flushAll();

        const envelope = EventEnvelopeSchema.parse(JSON.parse(await memberFrames.next())) as EventEnvelope;
        expect(envelope.event).toBe(Events.EVENT_AVAILABILITY_CHANGED);

        // …e un solo frame sul filo.
        expect(memberFrames.buffered()).toBe(0);
        expect(broadcast.pendingCount()).toBe(0);
    });

    it("il payload non porta contatori: è un trigger di refetch, non un canale di dati", async () => {
        // Un impegno reale muove i contatori; il frame resta comunque minimale, e
        // il frontend rifà la chiamata REST.
        await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 10 });
        const registration = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.LEADER,
        });
        expect(registration.id).toBeGreaterThan(0);

        broadcast.notify(scenario.event.id, scenario.organizationId);
        await broadcast.flush(scenario.event.id);

        const envelope = EventEnvelopeSchema.parse(JSON.parse(await memberFrames.next())) as EventEnvelope;
        expect(Object.keys(envelope.payload as object).sort()).toEqual(["eventId", "organizationId"]);
    });
});
