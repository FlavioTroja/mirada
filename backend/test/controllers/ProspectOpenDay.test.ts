import { EventTypeFamily, RegistrationStatus } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { encryptPasswordSync } from "@utils/helpers/crypto";
import { login } from "../helpers";
import { createEventScenario } from "../fixtures/capacity";

const app = (globalThis as any).__TEST_APP__;

let sequence = 0;
const unique = (p: string) => `${p}${Date.now().toString(36)}${++sequence}`;

/**
 * **I prospect dell'open day** — `19-prospect.md`.
 *
 * Chi viene a provare e non si iscrive è un contatto da non perdere. Le prove
 * difendono tre cose: che il contatto resti **della scuola** che l'ha raccolto,
 * che non si raccolga senza consenso e senza un recapito, e che chi poi si
 * iscrive **esca da solo** dall'elenco da chiamare.
 */
describe("I prospect dell'open day", () => {
    const PASSWORD = "secret";
    const prisma = () => getPrismaClient();

    /** Un titolare con la sua scuola e un corso. */
    async function scuola() {
        const scenario = await createEventScenario({ family: EventTypeFamily.COURSE });
        const tag = unique("owner");
        const user = await prisma().user.create({
            data: {
                username: tag,
                password: encryptPasswordSync(PASSWORD),
                emailVerifiedAt: new Date(),
                roles: { create: { roleName: "OWNER", isActive: true } },
                person: {
                    create: {
                        name: "Titolare",
                        surname: tag,
                        personType: "USER",
                        contact: { create: { email: `${tag}@test.it` } },
                    },
                },
            },
        });
        await prisma().organizationMember.create({
            data: { organizationId: scenario.organizationId, userId: user.id, role: "OWNER", acceptedAt: new Date() },
        });
        return { scenario, session: await login(app, tag, PASSWORD) };
    }

    function crea(session: string, payload: Record<string, unknown>) {
        return app.inject({ method: "POST", url: "/api/prospects/create", headers: { authorization: session }, payload });
    }

    function elenca(session: string, query: Record<string, unknown> = {}) {
        return app.inject({
            method: "POST",
            url: "/api/prospects/",
            headers: { authorization: session },
            payload: { query, options: { page: 1, limit: 50 } },
        });
    }

    it("raccoglie un prospect sul corso, con l'organizzazione del corso e la data del consenso", async () => {
        const { scenario, session } = await scuola();

        const res = await crea(session, {
            sourceEventId: scenario.event.id,
            name: "Lucia",
            email: "Lucia.Rossi@Example.com",
            preferredRole: "FOLLOWER",
            consent: true,
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().organizationId).toBe(scenario.organizationId);
        expect(res.json().status).toBe("TO_CONTACT");
        // Minuscola: è la chiave con cui la si riconosce quando si iscrive.
        expect(res.json().email).toBe("lucia.rossi@example.com");
        expect(res.json().consentAt).toBeTruthy();
    });

    it("rifiuta un prospect senza consenso", async () => {
        const { scenario, session } = await scuola();
        const res = await crea(session, { sourceEventId: scenario.event.id, name: "Gino", phone: "333 1234567" });
        expect(res.statusCode).toBe(400);
    });

    it("rifiuta un prospect senza email né telefono", async () => {
        const { scenario, session } = await scuola();
        const res = await crea(session, { sourceEventId: scenario.event.id, name: "Gino", email: "", consent: true });
        expect(res.statusCode).toBe(400);
        expect(res.json().message).toContain("recapito");
    });

    it("accetta il solo telefono", async () => {
        const { scenario, session } = await scuola();
        const res = await crea(session, { sourceEventId: scenario.event.id, name: "Gino", phone: "333 1234567", consent: true });
        expect(res.statusCode).toBe(200);
        expect(res.json().email).toBeNull();
    });

    it("non raccoglie prospect su un evento che non è un corso", async () => {
        const { session, scenario } = await scuola();
        const festival = await createEventScenario();
        // Stessa organizzazione, per provare la famiglia e non la tenancy.
        await prisma().event.update({ where: { id: festival.event.id }, data: { organizationId: scenario.organizationId } });

        const res = await crea(session, { sourceEventId: festival.event.id, name: "Gino", phone: "333", consent: true });
        expect(res.statusCode).toBe(400);
    });

    it("non mostra i prospect di un'altra scuola, e non ne accetta su un suo corso", async () => {
        const a = await scuola();
        const b = await scuola();
        const created = await crea(a.session, { sourceEventId: a.scenario.event.id, name: "Anna", phone: "1", consent: true });
        expect(created.statusCode).toBe(200);

        const list = await elenca(b.session);
        expect(list.statusCode).toBe(200);
        expect(list.json().docs.map((p: { id: number }) => p.id)).not.toContain(created.json().id);

        const read = await app.inject({ method: "GET", url: `/api/prospects/${created.json().id}`, headers: { authorization: b.session } });
        expect(read.statusCode).toBe(404);

        const foreign = await crea(b.session, { sourceEventId: a.scenario.event.id, name: "X", phone: "1", consent: true });
        expect(foreign.statusCode).toBe(404);
    });

    it("chi si iscrive a un corso della scuola esce da solo dall'elenco da chiamare", async () => {
        const { scenario, session } = await scuola();
        const email = `${unique("marta")}@test.it`;
        const created = await crea(session, { sourceEventId: scenario.event.id, name: "Marta", email, consent: true });
        expect(created.statusCode).toBe(200);

        const before = await elenca(session, { converted: false, status: "TO_CONTACT" });
        expect(before.json().docs.map((p: { id: number }) => p.id)).toContain(created.json().id);

        // Si iscrive — con le maiuscole, come capita — al corso della stessa scuola.
        const registration = await prisma().registration.create({
            data: {
                eventId: scenario.event.id,
                holderName: "Marta",
                holderSurname: "Conti",
                holderEmail: email.toUpperCase(),
                declaredRole: "FOLLOWER",
                channel: "COMPLIMENTARY",
                status: RegistrationStatus.CONFIRMED,
            },
        });

        const after = await elenca(session, { converted: false, status: "TO_CONTACT" });
        expect(after.statusCode).toBe(200);
        expect(after.json().docs.map((p: { id: number }) => p.id)).not.toContain(created.json().id);

        const read = await app.inject({ method: "GET", url: `/api/prospects/${created.json().id}`, headers: { authorization: session } });
        expect(read.json().convertedRegistrationId).toBe(registration.id);
    });

    it("un'iscrizione rifiutata non converte", async () => {
        const { scenario, session } = await scuola();
        const email = `${unique("rifiutata")}@test.it`;
        const created = await crea(session, { sourceEventId: scenario.event.id, name: "Rita", email, consent: true });
        await prisma().registration.create({
            data: {
                eventId: scenario.event.id,
                holderName: "Rita",
                holderSurname: "R",
                holderEmail: email,
                declaredRole: "FOLLOWER",
                channel: "COMPLIMENTARY",
                status: RegistrationStatus.DECLINED,
            },
        });

        const read = await app.inject({ method: "GET", url: `/api/prospects/${created.json().id}`, headers: { authorization: session } });
        expect(read.json().convertedRegistrationId).toBeNull();
    });

    it("segna contattati in blocco, con la data scritta dal server", async () => {
        const { scenario, session } = await scuola();
        const ids: number[] = [];
        for (const name of ["Uno", "Due"]) {
            const res = await crea(session, { sourceEventId: scenario.event.id, name, phone: "1", consent: true });
            ids.push(res.json().id);
        }

        const res = await app.inject({
            method: "POST",
            url: "/api/prospects/mark-contacted",
            headers: { authorization: session },
            payload: { ids },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().updated).toBe(2);

        const rows = await prisma().prospect.findMany({ where: { id: { in: ids } } });
        expect(rows.every(r => r.status === "CONTACTED" && r.contactedAt)).toBe(true);
    });

    it("non segna niente se anche un solo contatto è di un'altra scuola", async () => {
        const a = await scuola();
        const b = await scuola();
        const mine = await crea(a.session, { sourceEventId: a.scenario.event.id, name: "Mio", phone: "1", consent: true });
        const theirs = await crea(b.session, { sourceEventId: b.scenario.event.id, name: "Suo", phone: "1", consent: true });

        const res = await app.inject({
            method: "POST",
            url: "/api/prospects/mark-contacted",
            headers: { authorization: a.session },
            payload: { ids: [mine.json().id, theirs.json().id] },
        });
        expect(res.statusCode).toBe(404);
        const row = await prisma().prospect.findUniqueOrThrow({ where: { id: mine.json().id } });
        expect(row.status).toBe("TO_CONTACT");
    });

    it("la cancellazione toglie davvero la riga", async () => {
        const { scenario, session } = await scuola();
        const created = await crea(session, { sourceEventId: scenario.event.id, name: "Via", phone: "1", consent: true });

        const res = await app.inject({ method: "DELETE", url: `/api/prospects/${created.json().id}`, headers: { authorization: session } });
        expect(res.statusCode).toBe(200);
        expect(await prisma().prospect.findUnique({ where: { id: created.json().id } })).toBeNull();
    });
});
