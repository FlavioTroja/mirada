import { EventTypeFamily, OrgMemberRole, RoleName } from "@prisma/client";
import { DateTime } from "luxon";
import { getPrismaClient } from "@utils/adapters/prisma";
import { encryptPasswordSync } from "@utils/helpers/crypto";
import { login } from "../helpers";
import { createEventScenario } from "../fixtures/capacity";

const app = (globalThis as any).__TEST_APP__;

let sequence = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${++sequence}`;

/**
 * L'attività per organizzazione — `21-dashboard.md` §4: la colonna «In tempo
 * reale» e il «Registro di oggi» della Dashboard.
 */
describe("GET /dashboard/activity", () => {
    const PASSWORD = "secret";
    const prisma = () => getPrismaClient();

    async function member(organizationId: number, role: OrgMemberRole, name = "Marco") {
        const tag = unique("act");
        const user = await prisma().user.create({
            data: {
                username: tag,
                password: encryptPasswordSync(PASSWORD),
                emailVerifiedAt: new Date(),
                roles: { create: { roleName: role as unknown as RoleName, isActive: true } },
                person: { create: { name, surname: "Tarantini", personType: "USER", contact: { create: { email: `${tag}@test.it` } } } },
            },
        });
        await prisma().organizationMember.create({ data: { organizationId, userId: user.id, role, acceptedAt: new Date() } });
        return { user, session: await login(app, tag, PASSWORD) };
    }

    const read = (session: string, query = "") =>
        app.inject({ method: "GET", url: `/api/dashboard/activity${query}`, headers: { authorization: session } });

    // Per prima: la pulizia gira al più una volta l'ora per processo.
    it("toglie le righe più vecchie di 30 giorni", async () => {
        const course = await createEventScenario({ family: EventTypeFamily.COURSE, sessions: 0 });
        const owner = await member(course.organizationId, OrgMemberRole.OWNER);
        const old = await prisma().activity.create({
            data: { organizationId: course.organizationId, kind: "CALENDAR", text: "Vecchia", createdAt: new Date(Date.now() - 40 * 86_400_000) },
        });

        const res = await read(owner.session, `?since=${new Date(Date.now() - 60 * 86_400_000).toISOString()}`);

        expect(res.statusCode).toBe(200);
        expect(await prisma().activity.findUnique({ where: { id: old.id } })).toBeNull();
    });

    it("le lezioni aggiunte dal calendario finiscono nel registro, con chi le ha aggiunte", async () => {
        const course = await createEventScenario({ family: EventTypeFamily.COURSE, sessions: 0 });
        await prisma().event.update({ where: { id: course.event.id }, data: { title: { it: "Corso Principianti" } } });
        const owner = await member(course.organizationId, OrgMemberRole.OWNER);
        const start = DateTime.fromISO("2027-10-21T18:30", { zone: "Europe/Rome" });

        const scheduled = await app.inject({
            method: "POST",
            url: "/api/sessions/schedule",
            headers: { authorization: owner.session },
            payload: {
                eventId: course.event.id,
                name: { it: "Lezione" },
                startAt: start.toISO(),
                endAt: start.plus({ minutes: 90 }).toISO(),
                recurrence: { weekdays: [4], count: 12 },
            },
        });
        expect(scheduled.statusCode).toBe(200);

        const log = await read(owner.session, "?staffOnly=true");
        expect(log.statusCode).toBe(200);
        expect(log.json()[0]).toMatchObject({
            kind: "CALENDAR",
            staff: true,
            actorName: "Marco T.",
            text: "12 lezioni aggiunte a Corso Principianti, dal giovedì 21 ottobre alle 18:30",
        });
    });

    it("un contatto dell'open day compare nel flusso, e un'altra organizzazione non lo vede", async () => {
        const course = await createEventScenario({ family: EventTypeFamily.COURSE, sessions: 0 });
        await prisma().event.update({ where: { id: course.event.id }, data: { title: { it: "Corso Avanzato" } } });
        const owner = await member(course.organizationId, OrgMemberRole.OWNER);

        const created = await app.inject({
            method: "POST",
            url: "/api/prospects/create",
            headers: { authorization: owner.session },
            payload: { sourceEventId: course.event.id, name: "Paolo", surname: "De Santis", phone: "3331234567", consent: true },
        });
        expect(created.statusCode).toBe(200);

        const feed = (await read(owner.session)).json();
        expect(feed[0]).toMatchObject({
            kind: "PROSPECT",
            severity: "WARNING",
            staff: false,
            text: "Nuovo contatto dall'open day di Corso Avanzato: Paolo De Santis, da ricontattare",
        });

        const other = await createEventScenario();
        const stranger = await member(other.organizationId, OrgMemberRole.OWNER);
        const theirs = (await read(stranger.session)).json();
        expect(theirs.some((row: any) => row.organizationId === course.organizationId)).toBe(false);
    });
});
