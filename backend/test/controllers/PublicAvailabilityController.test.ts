import { DanceRole, QuotaScope } from "@prisma/client";
import { createEventScenario, createQuota, createRoleQuotas } from "../fixtures/capacity";

const app = (globalThis as any).__TEST_APP__;

/**
 * Il contatore del rate limiting vive nel registro di moduli DELL'APP, non in
 * quello del file di test (stessa ragione per cui la WSS globale non è visibile
 * qui — regola 9 di `testing.md`). Non è quindi azzerabile dal test: ogni caso
 * usa un indirizzo diverso, che è anche il modo più fedele di rappresentare
 * visitatori distinti.
 */
let clientCounter = 0;
const nextClientAddress = () => `10.0.0.${++clientCounter}`;

/**
 * `POST /api/public/events/:id/availability` — §3.7.
 *
 * **Senza autenticazione** e con **rate limiting**: è la sorgente del polling a
 * 10–15 s del pubblico anonimo e, in apertura vendite, l'endpoint più interrogato
 * del sistema (§7 D-H).
 */
describe("POST /api/public/events/:id/availability", () => {
    it("risponde SENZA token e restituisce la forma dichiarata dal §3.7", async () => {
        const scenario = await createEventScenario();
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 40,
            consumed: 12,
        });
        await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 60,
            followerLimit: 60,
            leaderConsumed: 30,
            followerConsumed: 28,
            tolerance: 5,
        });

        const res = await app.inject({
            method: "POST",
            url: `/api/public/events/${scenario.event.id}/availability`,
            payload: {},
            remoteAddress: nextClientAddress(),
        });

        expect(res.statusCode).toBe(200);

        const body = res.json();
        expect(body.eventId).toBe(scenario.event.id);
        expect(Array.isArray(body.ticketTypes)).toBe(true);

        const pass = body.ticketTypes.find((t: { id: number }) => t.id === scenario.ticketTypeId);
        expect(pass).toMatchObject({ remaining: 28, soldOut: false, roleOnHold: false });
        expect(pass.activeTier).toMatchObject({ price: 9_000 });

        expect(body.roles).toEqual({ leader: 30, follower: 32 });
        expect(body.rolesOnHold).toEqual({ leader: false, follower: false });
        expect(body.imbalance).toBe(2);
    });

    it("restringe la scarsità al ruolo dell'utente quando il corpo lo indica", async () => {
        const scenario = await createEventScenario();
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 100,
        });
        await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 60,
            followerLimit: 60,
            leaderConsumed: 58,
            followerConsumed: 10,
        });

        const res = await app.inject({
            method: "POST",
            url: `/api/public/events/${scenario.event.id}/availability`,
            payload: { role: DanceRole.LEADER },
            remoteAddress: nextClientAddress(),
        });

        expect(res.statusCode).toBe(200);
        // La quota più stretta applicabile al ruolo LEADER è la quota di ruolo: 2.
        expect(res.json().ticketTypes[0].remaining).toBe(2);
    });

    it("le quote riservate non compaiono nella disponibilità pubblica", async () => {
        const scenario = await createEventScenario();
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 100,
            consumed: 10,
        });
        // Contingente accrediti completamente esaurito: non deve influenzare
        // in alcun modo ciò che il pubblico vede in vendita (`05` §2.1).
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 5,
            consumed: 5,
            reservedFor: "COMPLIMENTARY",
        });

        const res = await app.inject({
            method: "POST",
            url: `/api/public/events/${scenario.event.id}/availability`,
            payload: {},
            remoteAddress: nextClientAddress(),
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().ticketTypes[0]).toMatchObject({ remaining: 90, soldOut: false });
    });

    it("applica il rate limiting: oltre il tetto risponde 429", async () => {
        const scenario = await createEventScenario();

        const address = nextClientAddress();
        const call = () => app.inject({
            method: "POST",
            url: `/api/public/events/${scenario.event.id}/availability`,
            payload: {},
            remoteAddress: address,
        });

        // Trenta richieste al minuto sono ampio margine per un polling a 10–15 s
        // (4–6 al minuto); la trentunesima è un client che non sta più facendo
        // polling, ed è ciò che in apertura vendite satura il pool.
        for (let i = 0; i < 30; i += 1) {
            expect((await call()).statusCode).toBe(200);
        }

        expect((await call()).statusCode).toBe(429);
    });

    it("un evento inesistente risponde 404, non 500", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/public/events/999999/availability",
            payload: {},
            remoteAddress: nextClientAddress(),
        });

        expect(res.statusCode).toBe(404);
    });
});
