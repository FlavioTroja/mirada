import { config } from "dotenv";
config({ path: ".env.test" });

import http from "http";
import WebSocket from "ws";
import { getPrismaClient } from "@utils/adapters/prisma";
import { closeWebSocketServer, initializeWebSocketServer } from "@websocket/server/WebSocketServer";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { EventEnvelope, EventEnvelopeSchema } from "@websocket/dtos/EventEnvelope";
import { CalendarChangedPayloadSchema } from "@websocket/dtos/CalendarChangedPayloadDTO";
import { CalendarBroadcastService } from "@services/CalendarBroadcastService";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";
import { OrganizationMemberRepository } from "@repositories/OrganizationMemberRepository";
import { UserRepository } from "@repositories/UserRepository";
import { createEventScenario } from "../fixtures/capacity";

/**
 * `calendar/changed` su un **socket reale** — `20-calendario.md` §6.1.
 *
 * Quando un collaboratore aggiunge una lezione, chi ha il calendario aperto
 * nella stessa organizzazione la deve vedere comparire; chi è di un'altra
 * organizzazione non deve ricevere nulla, nemmeno il segnale che qualcosa è
 * cambiato.
 */
describe("calendar/changed — ai soli membri dell'organizzazione, su socket reale", () => {
    const MEMBER_WS_CODE = "ws-cal-member";
    const OUTSIDER_WS_CODE = "ws-cal-outsider";

    let httpServer: http.Server;
    let port: number;
    let broadcast: CalendarBroadcastService;
    let memberClient: WebSocket;
    let outsiderClient: WebSocket;
    const memberFrames: string[] = [];
    const outsiderFrames: string[] = [];
    let organizationId: number;

    function connect(wsCode: string, sink: string[]): Promise<WebSocket> {
        return new Promise((resolve, reject) => {
            const client = new WebSocket(`ws://localhost:${port}/${wsCode}`);
            client.on("message", data => sink.push(data.toString()));
            client.once("open", () => resolve(client));
            client.once("error", reject);
        });
    }

    async function until(check: () => boolean, timeoutMs = 8_000): Promise<void> {
        const started = Date.now();
        while (!check()) {
            if (Date.now() - started > timeoutMs) throw new Error("timed out waiting for a frame");
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    }

    beforeAll(async () => {
        const prisma = getPrismaClient();
        const scenario = await createEventScenario();
        organizationId = scenario.organizationId;

        await prisma.user.updateMany({ where: { username: "god" }, data: { wsCode: MEMBER_WS_CODE } });
        await prisma.user.updateMany({ where: { username: "user" }, data: { wsCode: OUTSIDER_WS_CODE } });
        const member = await prisma.user.findFirstOrThrow({ where: { username: "god" } });
        await prisma.organizationMember.create({
            data: { organizationId, userId: member.id, role: "OWNER", invitedAt: new Date() },
        });

        httpServer = http.createServer();
        initializeWebSocketServer(httpServer);
        await new Promise<void>(resolve => httpServer.listen(0, "localhost", () => resolve()));
        port = (httpServer.address() as { port: number }).port;

        // Istanze a mano: la WSS singleton di questo modulo Jest dev'essere quella
        // che il publisher vede (regola 9 di `testing.md`).
        const audience = new OrganizationAudienceService(new OrganizationMemberRepository(), new UserRepository());
        broadcast = new CalendarBroadcastService(audience, new WsPublisherService());

        memberClient = await connect(MEMBER_WS_CODE, memberFrames);
        outsiderClient = await connect(OUTSIDER_WS_CODE, outsiderFrames);
        await until(() => memberFrames.length === 1 && outsiderFrames.length === 1); // i due `system/welcome`
    });

    afterAll(async () => {
        memberClient?.close();
        outsiderClient?.close();
        closeWebSocketServer();
        await new Promise<void>(resolve => httpServer.close(() => resolve()));
    });

    it("consegna il periodo toccato ai membri, e niente all'estraneo", async () => {
        await broadcast.publishChanged(organizationId, "SESSION", [
            { startAt: new Date("2027-10-26T19:30:00Z"), endAt: new Date("2027-10-26T21:00:00Z") },
            { startAt: new Date("2027-10-19T18:30:00Z"), endAt: new Date("2027-10-19T20:00:00Z") },
        ]);

        await until(() => memberFrames.length === 2);
        const envelope = EventEnvelopeSchema.parse(JSON.parse(memberFrames[1]!)) as EventEnvelope;
        expect(envelope.event).toBe(Events.CALENDAR_CHANGED);
        expect(CalendarChangedPayloadSchema.parse(envelope.payload)).toEqual({
            organizationId,
            from: "2027-10-19T18:30:00.000Z",
            to: "2027-10-26T21:00:00.000Z",
            source: "SESSION",
        });

        // Il tempo di un giro: l'estraneo resta al solo benvenuto.
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(outsiderFrames).toHaveLength(1);
    });
});
