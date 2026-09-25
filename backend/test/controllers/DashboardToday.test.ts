import { DeclaredDanceRole, EventTypeFamily, OrgMemberRole, RoleName } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { encryptPasswordSync } from "@utils/helpers/crypto";
import { login } from "../helpers";
import { createEventScenario, createRegistration } from "../fixtures/capacity";
import { createCheckIn, createTicketFor } from "../fixtures/tickets";

const app = (globalThis as any).__TEST_APP__;

let sequence = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${++sequence}`;

/**
 * La giornata dell'organizzazione — `21-dashboard.md` §3.
 *
 * Le sessioni nascono **adesso**: la Dashboard legge il giorno corrente, e una
 * prova con date fisse diventerebbe falsa il giorno dopo.
 */
describe("GET /dashboard/today", () => {
    const PASSWORD = "secret";
    const prisma = () => getPrismaClient();

    async function member(organizationId: number, role: OrgMemberRole) {
        const tag = unique("dash");
        const user = await prisma().user.create({
            data: {
                username: tag,
                password: encryptPasswordSync(PASSWORD),
                emailVerifiedAt: new Date(),
                roles: { create: { roleName: role as unknown as RoleName, isActive: true } },
                person: {
                    create: { name: "Staff", surname: tag, personType: "USER", contact: { create: { email: `${tag}@test.it` } } },
                },
            },
        });
        await prisma().organizationMember.create({ data: { organizationId, userId: user.id, role, acceptedAt: new Date() } });
        return { user, session: await login(app, tag, PASSWORD) };
    }

    const minutes = (n: number) => new Date(Date.now() + n * 60_000);

    /**
     * Una serata in corso (festival, con biglietti) e una lezione in corso (corso,
     * senza biglietti), nella stessa organizzazione.
     */
    async function tonight() {
        const festival = await createEventScenario({ family: EventTypeFamily.EVENT, sessions: 0 });
        const org = festival.organizationId;
        const milonga = await prisma().session.create({
            data: { eventId: festival.event.id, name: { it: "Milonga" }, startAt: minutes(-30), endAt: minutes(90) },
        });
        await prisma().ticketTypeSession.create({ data: { ticketTypeId: festival.ticketTypeId, sessionId: milonga.id } });

        const course = await createEventScenario({ family: EventTypeFamily.COURSE, sessions: 0 });
        await prisma().event.update({ where: { id: course.event.id }, data: { organizationId: org } });
        await prisma().session.create({
            data: { eventId: course.event.id, name: { it: "Lezione" }, startAt: minutes(-10), endAt: minutes(80) },
        });

        const owner = await member(org, OrgMemberRole.OWNER);
        return { festival, course, milonga, org, owner };
    }

    const get = (session: string) =>
        app.inject({ method: "GET", url: "/api/dashboard/today", headers: { authorization: session } });

    it("conta attesi e ingressi della serata, e per la lezione dà gli iscritti ma nessuna presenza", async () => {
        const t = await tonight();
        const a = await createTicketFor({ eventId: t.festival.event.id, ticketTypeId: t.festival.ticketTypeId, role: "LEADER" });
        await createTicketFor({ eventId: t.festival.event.id, ticketTypeId: t.festival.ticketTypeId });
        await createCheckIn({ ticketId: a.ticket.id, sessionId: t.milonga.id, registrationId: a.registrationId, operatorUserId: t.owner.user.id });
        await createRegistration({ eventId: t.course.event.id, declaredRole: DeclaredDanceRole.FOLLOWER });
        await createRegistration({ eventId: t.course.event.id, declaredRole: DeclaredDanceRole.LEADER });

        const res = await get(t.owner.session);

        expect(res.statusCode).toBe(200);
        const body = res.json();
        const milonga = body.sessions.find((s: any) => s.id === t.milonga.id);
        expect(milonga).toMatchObject({ family: "EVENT", phase: "ONGOING", expected: 2, entries: 1, leaders: 1, followers: 0 });

        const lesson = body.sessions.find((s: any) => s.eventId === t.course.event.id);
        // Una lezione non emette biglietti (RF-COR-6): zero ingressi sarebbe falso.
        expect(lesson).toMatchObject({ family: "COURSE", phase: "ONGOING", expected: 2, entries: null });

        expect(body.inRoom).toBe(1);
        expect(body.expectedToday).toBe(2);
        expect(body.entriesByQuarter).toHaveLength(96);
        expect(body.entriesByQuarter.reduce((a: number, b: number) => a + b, 0)).toBe(1);
    });

    it("conta le iscrizioni e gli incassi di oggi, e i saldi ancora aperti", async () => {
        const t = await tonight();
        const reg = await createRegistration({ eventId: t.festival.event.id, declaredRole: DeclaredDanceRole.LEADER, status: "CONFIRMED" });
        await prisma().registration.update({ where: { id: reg.id }, data: { balanceDueAmount: 12_000, balanceSettledAmount: 5_000 } });
        await prisma().balanceSettlement.create({
            data: { registrationId: reg.id, amount: 5_000, method: "CASH", operatorUserId: t.owner.user.id },
        });

        const body = (await get(t.owner.session)).json();

        expect(body.registrations.today).toBe(1);
        expect(body.registrations.byFamily).toEqual({ EVENT: 1, COURSE: 0 });
        expect(body.registrations.lastDays).toHaveLength(8);
        expect(body.money.boxOffice).toBe(5_000);
        expect(body.money.total).toBe(5_000);
        expect(body.money.cumulativeByHour[23]).toBe(5_000);
        expect(body.money.openBalances).toEqual({ count: 1, amount: 7_000 });
    });

    it("il prossimo evento porta il suo cruscotto", async () => {
        const t = await tonight();
        const body = (await get(t.owner.session)).json();
        expect(body.nextEvent?.id).toBe(t.festival.event.id);
        expect(body.nextEvent.dashboard).toBeDefined();
    });

    it("un'altra organizzazione non vede niente, e la porta non ha la Dashboard", async () => {
        const t = await tonight();
        const other = await createEventScenario();
        const stranger = await member(other.organizationId, OrgMemberRole.OWNER);

        const seen = (await get(stranger.session)).json();
        expect(seen.sessions.some((s: any) => s.eventId === t.festival.event.id)).toBe(false);

        const door = await member(t.org, OrgMemberRole.CHECKIN_OPERATOR);
        expect((await get(door.session)).statusCode).toBe(403);
    });
});
