import { DateTime } from "luxon";
import { EventTypeFamily, OrgMemberRole, RoleName } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { encryptPasswordSync } from "@utils/helpers/crypto";
import { login } from "../helpers";
import { createEventScenario } from "../fixtures/capacity";
import { createCheckIn, createTicketFor } from "../fixtures/tickets";

const app = (globalThis as any).__TEST_APP__;

let sequence = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${++sequence}`;

const ZONE = "Europe/Rome";
const local = (iso: string) => DateTime.fromISO(iso, { zone: ZONE }).toISO()!;
const clock = (iso: string) => DateTime.fromISO(iso, { zone: ZONE }).toFormat("yyyy-MM-dd HH:mm");

/**
 * Il calendario dell'organizzatore — `20-calendario.md`.
 *
 * Le date fisse sono nel 2027 di proposito: il 31 ottobre 2027 finisce l'ora
 * legale, e le prove devono restare nel futuro per anni.
 */
describe("Il calendario dell'organizzatore", () => {
    const PASSWORD = "secret";
    const prisma = () => getPrismaClient();

    async function member(organizationId: number, role: OrgMemberRole) {
        const tag = unique("staff");
        const user = await prisma().user.create({
            data: {
                username: tag,
                password: encryptPasswordSync(PASSWORD),
                emailVerifiedAt: new Date(),
                roles: { create: { roleName: role as unknown as RoleName, isActive: true } },
                person: {
                    create: {
                        name: "Staff",
                        surname: tag,
                        personType: "USER",
                        contact: { create: { email: `${tag}@test.it` } },
                    },
                },
            },
        });
        await prisma().organizationMember.create({
            data: { organizationId, userId: user.id, role, acceptedAt: new Date() },
        });
        return { user, session: await login(app, tag, PASSWORD) };
    }

    /** Un corso con due lezioni, «Trimestre intero» che le comprende e «Lezione singola» che ne ha una. */
    async function corso() {
        const scenario = await createEventScenario({ family: EventTypeFamily.COURSE, sessions: 2 });
        const single = await prisma().ticketType.create({
            data: {
                eventId: scenario.event.id,
                name: { it: "Lezione singola" },
                basePrice: 1_500,
                sessions: { create: [{ sessionId: scenario.sessionIds[0]! }] },
            },
        });
        const owner = await member(scenario.organizationId, OrgMemberRole.OWNER);
        return { ...scenario, fullPassId: scenario.ticketTypeId, singleId: single.id, owner };
    }

    const schedule = (session: string, payload: object) =>
        app.inject({ method: "POST", url: "/api/sessions/schedule", headers: { authorization: session }, payload });

    it("una serie del martedì resta alle 20:30 dopo la fine dell'ora legale, e allunga solo il titolo completo", async () => {
        const c = await corso();

        const res = await schedule(c.owner.session, {
            eventId: c.event.id,
            name: { it: "Lezione" },
            startAt: local("2027-10-19T20:30"),
            endAt: local("2027-10-19T22:00"),
            recurrence: { weekdays: [2], until: "2027-11-09" },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.sessions.map((s: any) => clock(s.startAt))).toEqual([
            "2027-10-19 20:30", "2027-10-26 20:30", "2027-11-02 20:30", "2027-11-09 20:30",
        ]);
        const seriesIds = new Set(body.sessions.map((s: any) => s.seriesId));
        expect(seriesIds.size).toBe(1);
        expect([...seriesIds][0]).toEqual(expect.any(String));

        // K3: il titolo che le comprendeva tutte si allunga, la lezione singola no.
        expect(body.extendedTicketTypes.map((t: any) => t.id)).toEqual([c.fullPassId]);
        const links = await prisma().ticketTypeSession.findMany({
            where: { sessionId: { in: body.sessions.map((s: any) => s.id) } },
        });
        expect(new Set(links.map(l => l.ticketTypeId))).toEqual(new Set([c.fullPassId]));
        expect(links).toHaveLength(4);
    });

    it("un open day nasce sul corso ma non entra in nessun titolo", async () => {
        const c = await corso();

        const res = await schedule(c.owner.session, {
            eventId: c.event.id,
            name: { it: "Open day" },
            kind: "OPEN_DAY",
            startAt: local("2027-09-20T20:00"),
            endAt: local("2027-09-20T21:30"),
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().sessions[0].kind).toBe("OPEN_DAY");
        expect(res.json().extendedTicketTypes).toEqual([]);
    });

    it("rifiuta un open day su un festival", async () => {
        const festival = await createEventScenario({ family: EventTypeFamily.EVENT });
        const owner = await member(festival.organizationId, OrgMemberRole.OWNER);

        const res = await schedule(owner.session, {
            eventId: festival.event.id,
            name: { it: "Open day" },
            kind: "OPEN_DAY",
            startAt: local("2027-09-20T20:00"),
            endAt: local("2027-09-20T21:30"),
        });

        expect(res.statusCode).toBe(400);
    });

    it("rifiuta una serie oltre le 104 occorrenze, e non ne crea nessuna", async () => {
        const c = await corso();
        const before = await prisma().session.count({ where: { eventId: c.event.id } });

        const res = await schedule(c.owner.session, {
            eventId: c.event.id,
            name: { it: "Lezione" },
            startAt: local("2027-10-19T20:30"),
            endAt: local("2027-10-19T22:00"),
            recurrence: { weekdays: [2], until: "2030-12-31" },
        });

        expect(res.statusCode).toBe(400);
        expect(await prisma().session.count({ where: { eventId: c.event.id } })).toBe(before);
    });

    it("«questo e i successivi» sposta l'ora da quella lezione in poi, ciascuna nel suo giorno", async () => {
        const c = await corso();
        const created = (await schedule(c.owner.session, {
            eventId: c.event.id,
            name: { it: "Lezione" },
            startAt: local("2027-10-19T20:30"),
            endAt: local("2027-10-19T22:00"),
            recurrence: { weekdays: [2], count: 4 },
        })).json().sessions;
        const third = created[2];

        const res = await app.inject({
            method: "PATCH",
            url: `/api/sessions/${third.id}/series`,
            headers: { authorization: c.owner.session },
            payload: { scope: "FOLLOWING", startAt: local("2027-11-02T21:00"), endAt: local("2027-11-02T22:30") },
        });

        expect(res.statusCode).toBe(200);
        const all = await prisma().session.findMany({ where: { seriesId: third.seriesId }, orderBy: { startAt: "asc" } });
        expect(all.map(s => clock(s.startAt.toISOString()))).toEqual([
            "2027-10-19 20:30", "2027-10-26 20:30", "2027-11-02 21:00", "2027-11-09 21:00",
        ]);
        expect(all.map(s => clock(s.endAt.toISOString()))).toEqual([
            "2027-10-19 22:00", "2027-10-26 22:00", "2027-11-02 22:30", "2027-11-09 22:30",
        ]);
    });

    it("rifiuta di spostare di giorno una serie", async () => {
        const c = await corso();
        const created = (await schedule(c.owner.session, {
            eventId: c.event.id,
            name: { it: "Lezione" },
            startAt: local("2027-10-19T20:30"),
            endAt: local("2027-10-19T22:00"),
            recurrence: { weekdays: [2], count: 3 },
        })).json().sessions;

        const res = await app.inject({
            method: "PATCH",
            url: `/api/sessions/${created[0].id}/series`,
            headers: { authorization: c.owner.session },
            payload: { scope: "ALL", startAt: local("2027-10-20T20:30"), endAt: local("2027-10-20T22:00") },
        });

        expect(res.statusCode).toBe(400);
    });

    it("eliminare la serie salta le lezioni passate e quelle con un check-in", async () => {
        const c = await corso();
        const start = DateTime.now().setZone(ZONE).minus({ weeks: 2 }).set({ hour: 20, minute: 30, second: 0, millisecond: 0 });
        const created = (await schedule(c.owner.session, {
            eventId: c.event.id,
            name: { it: "Lezione" },
            startAt: start.toISO(),
            endAt: start.plus({ minutes: 90 }).toISO(),
            recurrence: { weekdays: [start.weekday], count: 5 },
        })).json().sessions;

        // Le prime due (−2 e −1 settimane) sono passate; la quarta ha un ingresso.
        const withEntry = created[3];
        const { ticket, registrationId } = await createTicketFor({ eventId: c.event.id, ticketTypeId: c.fullPassId });
        await createCheckIn({ ticketId: ticket.id, sessionId: withEntry.id, registrationId, operatorUserId: c.owner.user.id });

        const res = await app.inject({
            method: "DELETE",
            url: `/api/sessions/${created[0].id}/series?scope=ALL`,
            headers: { authorization: c.owner.session },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ deleted: 2, skippedPast: 2, skippedWithCheckIns: 1 });
        const alive = await prisma().session.findMany({ where: { seriesId: withEntry.seriesId, deleted: false } });
        expect(alive.map(s => s.id).sort()).toEqual([created[0].id, created[1].id, withEntry.id].sort());
    });

    it("il calendario mostra le lezioni del periodo, anche le annullate, e rifiuta periodi oltre 45 giorni", async () => {
        const c = await corso();
        const created = (await schedule(c.owner.session, {
            eventId: c.event.id,
            name: { it: "Lezione" },
            startAt: local("2027-10-19T20:30"),
            endAt: local("2027-10-19T22:00"),
            recurrence: { weekdays: [2], count: 3 },
        })).json().sessions;
        await prisma().session.update({ where: { id: created[1].id }, data: { cancelledAt: new Date() } });

        const res = await app.inject({
            method: "POST",
            url: "/api/sessions/calendar",
            headers: { authorization: c.owner.session },
            payload: { from: local("2027-10-18T00:00"), to: local("2027-10-25T00:00") },
        });
        expect(res.statusCode).toBe(200);
        const ours = res.json().filter((s: any) => s.eventId === c.event.id);
        expect(ours.map((s: any) => s.id)).toEqual([created[0].id]);
        expect(ours[0].event.eventType.family).toBe("COURSE");

        const week = await app.inject({
            method: "POST",
            url: "/api/sessions/calendar",
            headers: { authorization: c.owner.session },
            payload: { from: local("2027-10-25T00:00"), to: local("2027-11-01T00:00") },
        });
        expect(week.json().find((s: any) => s.id === created[1].id).cancelledAt).not.toBeNull();

        const tooLong = await app.inject({
            method: "POST",
            url: "/api/sessions/calendar",
            headers: { authorization: c.owner.session },
            payload: { from: local("2027-10-01T00:00"), to: local("2027-12-01T00:00") },
        });
        expect(tooLong.statusCode).toBe(400);
    });

    it("un'altra organizzazione non vede il calendario, e chi fa il check-in legge ma non crea", async () => {
        const c = await corso();
        await schedule(c.owner.session, {
            eventId: c.event.id,
            name: { it: "Lezione" },
            startAt: local("2027-10-19T20:30"),
            endAt: local("2027-10-19T22:00"),
        });
        const range = { from: local("2027-10-18T00:00"), to: local("2027-10-25T00:00") };

        const other = await createEventScenario();
        const stranger = await member(other.organizationId, OrgMemberRole.OWNER);
        const seen = await app.inject({ method: "POST", url: "/api/sessions/calendar", headers: { authorization: stranger.session }, payload: range });
        expect(seen.statusCode).toBe(200);
        expect(seen.json().filter((s: any) => s.eventId === c.event.id)).toEqual([]);

        const door = await member(c.organizationId, OrgMemberRole.CHECKIN_OPERATOR);
        const read = await app.inject({ method: "POST", url: "/api/sessions/calendar", headers: { authorization: door.session }, payload: range });
        expect(read.json().some((s: any) => s.eventId === c.event.id)).toBe(true);

        const write = await schedule(door.session, {
            eventId: c.event.id,
            name: { it: "Lezione abusiva" },
            startAt: local("2027-10-21T20:30"),
            endAt: local("2027-10-21T22:00"),
        });
        expect(write.statusCode).toBe(403);
    });

    it("gli eventi su più giorni finiscono nella fascia alta, i corsi no", async () => {
        const festival = await createEventScenario({ family: EventTypeFamily.EVENT });
        const course = await createEventScenario({ family: EventTypeFamily.COURSE });
        await prisma().event.update({ where: { id: course.event.id }, data: { organizationId: festival.organizationId } });
        const owner = await member(festival.organizationId, OrgMemberRole.OWNER);

        const from = new Date(festival.event.startAt.getTime() - 86_400_000).toISOString();
        const to = new Date(festival.event.endAt.getTime() + 86_400_000).toISOString();
        const res = await app.inject({
            method: "POST",
            url: "/api/events/calendar",
            headers: { authorization: owner.session },
            payload: { from, to },
        });

        expect(res.statusCode).toBe(200);
        const ids = res.json().map((e: any) => e.id);
        expect(ids).toContain(festival.event.id);
        expect(ids).not.toContain(course.event.id);
    });

    describe("appuntamenti dello staff", () => {
        it("una riunione ogni giovedì nasce in serie nell'organizzazione del chiamante, e la porta la legge", async () => {
            const scenario = await createEventScenario();
            const owner = await member(scenario.organizationId, OrgMemberRole.OWNER);

            const res = await app.inject({
                method: "POST",
                url: "/api/appointments/schedule",
                headers: { authorization: owner.session },
                payload: {
                    title: "Riunione staff",
                    startAt: local("2027-10-21T21:00"),
                    endAt: local("2027-10-21T22:00"),
                    recurrence: { weekdays: [4], count: 3 },
                },
            });

            expect(res.statusCode).toBe(200);
            const created = res.json();
            expect(created).toHaveLength(3);
            expect(created.every((a: any) => a.organizationId === scenario.organizationId)).toBe(true);
            expect(created.map((a: any) => clock(a.startAt))).toEqual([
                "2027-10-21 21:00", "2027-10-28 21:00", "2027-11-04 21:00",
            ]);

            const door = await member(scenario.organizationId, OrgMemberRole.CHECKIN_OPERATOR);
            const read = await app.inject({
                method: "POST",
                url: "/api/appointments/calendar",
                headers: { authorization: door.session },
                payload: { from: local("2027-10-18T00:00"), to: local("2027-11-08T00:00") },
            });
            expect(read.statusCode).toBe(200);
            expect(read.json()).toHaveLength(3);

            const write = await app.inject({
                method: "DELETE",
                url: `/api/appointments/${created[0].id}`,
                headers: { authorization: door.session },
            });
            expect(write.statusCode).toBe(403);
        });

        it("«solo questo» fa uscire l'appuntamento dalla serie, «tutti» tocca il resto", async () => {
            const scenario = await createEventScenario();
            const owner = await member(scenario.organizationId, OrgMemberRole.OWNER);
            const created = (await app.inject({
                method: "POST",
                url: "/api/appointments/schedule",
                headers: { authorization: owner.session },
                payload: {
                    title: "Prove spettacolo",
                    startAt: local("2027-10-23T10:00"),
                    endAt: local("2027-10-23T12:00"),
                    recurrence: { weekdays: [6], count: 3 },
                },
            })).json();

            const only = await app.inject({
                method: "PATCH",
                url: `/api/appointments/${created[1].id}`,
                headers: { authorization: owner.session },
                payload: { title: "Prove generali", seriesId: null },
            });
            expect(only.statusCode).toBe(200);
            expect(only.json().seriesId).toBeNull();

            const all = await app.inject({
                method: "PATCH",
                url: `/api/appointments/${created[0].id}/series`,
                headers: { authorization: owner.session },
                payload: { scope: "ALL", room: "Sala grande" },
            });
            expect(all.statusCode).toBe(200);
            expect(all.json().map((a: any) => a.id)).toEqual([created[0].id, created[2].id]);

            const detached = await prisma().appointment.findUniqueOrThrow({ where: { id: created[1].id } });
            expect(detached.room).toBeNull();
            expect(detached.title).toBe("Prove generali");
        });
    });
});
