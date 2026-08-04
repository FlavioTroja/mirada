import { DeclaredDanceRole, QuotaScope } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { login } from "../helpers";
import { createEventScenario, createQuota, createRegistration, readConsumed } from "../fixtures/capacity";

const app = (globalThis as any).__TEST_APP__;

/**
 * Le rotte della fase C sul filo HTTP: permessi, forma del contratto e le due
 * rotte non-CRUD del §3.7 che il motore rende costruibili.
 */
describe("Rotte del motore di capienza (fase C)", () => {
    let god: string;

    beforeAll(async () => {
        god = await login(app, "god", "god");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CapacityQuota — CRUD e campi calcolati dal server
    // ─────────────────────────────────────────────────────────────────────────

    it("crea una quota e IGNORA il `consumed` inviato dal client", async () => {
        const scenario = await createEventScenario();

        const res = await app.inject({
            method: "POST",
            url: "/api/capacity-quotas/create",
            headers: { authorization: god },
            payload: {
                eventId: scenario.event.id,
                scope: QuotaScope.TICKET_TYPE,
                scopeId: scenario.ticketTypeId,
                limit: 150,
                // Campo calcolato dal server (§5): il DTO lo rifiuta a monte, e in
                // nessun caso può arrivare al database.
                consumed: 999,
            },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().consumed).toBe(0);
    });

    it("rifiuta la cancellazione di una quota con posti impegnati", async () => {
        const scenario = await createEventScenario();
        const quota = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 100,
            consumed: 3,
        });

        const res = await app.inject({
            method: "DELETE",
            url: `/api/capacity-quotas/${quota.id}`,
            headers: { authorization: god },
        });

        expect(res.statusCode).toBe(400);
        expect(res.json().message).toContain("non può essere eliminata");
    });

    it("espone la verifica delle invarianti del `05` §12", async () => {
        const scenario = await createEventScenario();
        await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 50 });

        const res = await app.inject({
            method: "GET",
            url: `/api/capacity-quotas/events/${scenario.event.id}/invariants`,
            headers: { authorization: god },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ eventId: scenario.event.id, ok: true, violations: [] });
    });

    it("`QuotaConsumption` è sola lettura: nessuna rotta di scrittura esiste", async () => {
        const create = await app.inject({
            method: "POST",
            url: "/api/quota-consumptions/create",
            headers: { authorization: god },
            payload: { capacityQuotaId: 1, registrationId: 1, quantity: 1 },
        });
        expect(create.statusCode).toBe(404);

        const remove = await app.inject({
            method: "DELETE",
            url: "/api/quota-consumptions/1",
            headers: { authorization: god },
        });
        expect(remove.statusCode).toBe(404);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // `POST /api/sessions/:id/cancel` — §3.7, `RF-EVT-35` e `RF-EVT-36`
    // ─────────────────────────────────────────────────────────────────────────

    it("annulla una sessione: rilascia le sue quote e restituisce i titoli con il peso di ripartizione", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });
        const first = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SESSION,
            scopeId: scenario.sessionIds[0]!,
            limit: 40,
        });
        const second = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SESSION,
            scopeId: scenario.sessionIds[1]!,
            limit: 40,
        });

        // Due iscrizioni con il Full Pass, che include entrambe le sessioni.
        const engineRes: number[] = [];
        for (let i = 0; i < 2; i += 1) {
            const registration = await createRegistration({
                eventId: scenario.event.id,
                declaredRole: DeclaredDanceRole.LEADER,
            });
            engineRes.push(registration.id);
        }
        const created = await app.inject({
            method: "POST",
            url: `/api/registrations/${engineRes[0]}/reassign-role`,
            headers: { authorization: god },
            payload: { role: "LEADER", ticketTypeId: scenario.ticketTypeId },
        });
        expect(created.statusCode).toBe(200);

        expect(await readConsumed(first.id)).toBe(1);
        expect(await readConsumed(second.id)).toBe(1);

        const res = await app.inject({
            method: "POST",
            url: `/api/sessions/${scenario.sessionIds[0]}/cancel`,
            headers: { authorization: god },
            payload: { reason: "Il maestro non può esserci" },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.session.cancelledAt).not.toBeNull();
        expect(body.session.cancellationReason).toBe("Il maestro non può esserci");
        // I titoli che la includono, con il loro peso: è ciò su cui si appoggiano
        // il rimborso proporzionale e la comunicazione ai soli interessati.
        expect(body.affectedTicketTypes).toEqual([
            expect.objectContaining({ id: scenario.ticketTypeId, allocationWeight: expect.any(Number) }),
        ]);

        // Rilasciate SOLO le quote di quella sessione.
        expect(await readConsumed(first.id)).toBe(0);
        expect(await readConsumed(second.id)).toBe(1);
        expect(await readConsumed(room.id)).toBe(1);
    });

    it("rifiuta l'annullamento senza motivazione", async () => {
        const scenario = await createEventScenario();

        const res = await app.inject({
            method: "POST",
            url: `/api/sessions/${scenario.sessionIds[0]}/cancel`,
            headers: { authorization: god },
            payload: {},
        });

        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe("ZodError");
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Registration · Couple
    // ─────────────────────────────────────────────────────────────────────────

    it("il `PATCH` di un'iscrizione non accetta `assignedRole`: la riassegnazione ha una rotta sua", async () => {
        const scenario = await createEventScenario();
        await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });
        const registration = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.LEADER,
        });

        const res = await app.inject({
            method: "PATCH",
            url: `/api/registrations/${registration.id}`,
            headers: { authorization: god },
            payload: { holderName: "Nuovo", assignedRole: "FOLLOWER" },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().holderName).toBe("Nuovo");
        // Il campo è stato semplicemente ignorato dallo schema: nessun contatore
        // può muoversi da un `PATCH`.
        expect(res.json().assignedRole).toBeNull();
    });

    it("lo scioglimento di una coppia non muove alcun consumo", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });

        const leader = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
        const follower = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.FOLLOWER });

        const couple = await app.inject({
            method: "POST",
            url: "/api/couples/create",
            headers: { authorization: god },
            payload: { eventId: scenario.event.id, registrationIds: [leader.id, follower.id] },
        });
        expect(couple.statusCode).toBe(200);
        expect(couple.json().registrations).toHaveLength(2);

        // Impegno reale delle due iscrizioni.
        for (const registration of [leader, follower]) {
            const res = await app.inject({
                method: "POST",
                url: `/api/registrations/${registration.id}/reassign-role`,
                headers: { authorization: god },
                payload: { role: registration.declaredRole === "LEADER" ? "LEADER" : "FOLLOWER" },
            });
            expect(res.statusCode).toBe(200);
        }
        expect(await readConsumed(room.id)).toBe(2);

        const dissolved = await app.inject({
            method: "POST",
            url: `/api/couples/${couple.json().id}/dissolve`,
            headers: { authorization: god },
        });

        expect(dissolved.statusCode).toBe(200);
        expect(dissolved.json().dissolvedAt).not.toBeNull();
        // Le persone restano, cambia solo il legame (`05` §8, caso T21).
        expect(await readConsumed(room.id)).toBe(2);

        const stillLinked = await getPrismaClient().registration.count({
            where: { coupleId: couple.json().id },
        });
        expect(stillLinked).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Effetto collaterale dichiarato del §1.3
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * `ADMIN` e `USER` del template **non appartengono al dominio** e non hanno
     * alcun permesso, per decisione del §1.3. Il token `admin` delle fixture di
     * serie riceve quindi `403` su ogni rotta del progetto: **è il comportamento
     * atteso**, non un difetto da "risolvere" concedendo permessi ad `ADMIN`.
     * Il test lo fissa, così la prossima persona non lo scambia per una
     * regressione.
     */
    it("il token `admin` del template riceve 403: ADMIN non ha e non deve avere permessi (§1.3)", async () => {
        const admin = await login(app, "admin", "admin");

        const res = await app.inject({
            method: "POST",
            url: "/api/capacity-quotas/",
            headers: { authorization: admin },
            payload: { query: {}, options: { page: 1, limit: 10 } },
        });

        expect(res.statusCode).toBe(403);
    });
});
