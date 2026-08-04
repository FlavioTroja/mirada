import { configureServiceTest } from "fastify-decorators/testing";
import { DanceRole, QuotaScope } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { CapacityQuotaService } from "@services/CapacityQuotaService";
import { createEventScenario, createQuota } from "../fixtures/capacity";

/**
 * Regole di **configurazione** delle quote — `05` §9 e §5.1, backend-brief §4.8.
 *
 * Il motore è collaudato altrove: qui si verifica ciò che governa come una quota
 * nasce, cambia e muore. È la superficie su cui l'organizzatore può fare danni, e
 * l'invariante che la protegge è una sola: **nessuna modifica di configurazione
 * può espellere qualcuno che è già dentro.**
 */
describe("CapacityQuotaService — configurazione delle quote (05 §5.1 e §9)", () => {
    let service: CapacityQuotaService;
    let godId: number;

    const message = async (fn: () => Promise<unknown>): Promise<string> => {
        try {
            await fn();
            return "OK";
        } catch (err) {
            return (err as Error).message;
        }
    };

    beforeAll(async () => {
        service = await configureServiceTest({ service: CapacityQuotaService });
        const god = await getPrismaClient().user.findFirstOrThrow({ where: { username: "god" } });
        godId = god.id;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // T17c — la capienza della sala
    // ─────────────────────────────────────────────────────────────────────────

    it("T17c — sulla capienza della sala `overbookAllowance` è forzato a 0 e `limiting` a true", async () => {
        const scenario = await createEventScenario();

        const room = await service.save(godId, {
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            scopeId: null,
            role: null,
            limit: 220,
            // Il client prova a chiedere sforamento e non-limitanza: entrambi ignorati.
            overbookAllowance: 5,
            limiting: false,
        } as never);

        expect(room.overbookAllowance).toBe(0);
        expect(room.limiting).toBe(true);
    });

    it("T17c — `overbookAllowance` NON è modificabile sulle quote di ambito EVENT", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 220 });

        expect(await message(() => service.updateById(godId, room.id, { overbookAllowance: 3 } as never)))
            .toContain("non ammettono sforamento");

        expect(await message(() => service.updateById(godId, room.id, { limiting: false } as never)))
            .toContain("sempre limitanti");

        const stored = await getPrismaClient().capacityQuota.findUniqueOrThrow({ where: { id: room.id } });
        expect(stored.overbookAllowance).toBe(0);
        expect(stored.limiting).toBe(true);
    });

    it("le quote di ruolo di ambito EVENT seguono la stessa regola della capienza di sala", async () => {
        const scenario = await createEventScenario();

        const leader = await service.save(godId, {
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            scopeId: null,
            role: DanceRole.LEADER,
            limit: 110,
            overbookAllowance: 4,
            limiting: false,
        } as never);

        expect(leader.overbookAllowance).toBe(0);
        expect(leader.limiting).toBe(true);
    });

    it("una quota commerciale, invece, ammette lo sforamento scelto dall'organizzatore", async () => {
        const scenario = await createEventScenario();

        const pass = await service.save(godId, {
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            role: null,
            limit: 150,
            overbookAllowance: 2,
        } as never);

        expect(pass.overbookAllowance).toBe(2);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Coerenza strutturale (§4.8)
    // ─────────────────────────────────────────────────────────────────────────

    it("rifiuta una quota di titolo o di servizio che porti un ruolo", async () => {
        const scenario = await createEventScenario();

        expect(await message(() => service.save(godId, {
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            role: DanceRole.LEADER,
            limit: 50,
        } as never))).toContain("per persona");
    });

    it("rifiuta una quota di sessione senza riferimento e una quota di evento che ne porta uno", async () => {
        const scenario = await createEventScenario();

        expect(await message(() => service.save(godId, {
            eventId: scenario.event.id,
            scope: QuotaScope.SESSION,
            scopeId: null,
            limit: 30,
        } as never))).toContain("richiede il riferimento");

        expect(await message(() => service.save(godId, {
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            scopeId: scenario.sessionIds[0]!,
            limit: 30,
        } as never))).toContain("non porta un riferimento");
    });

    it("rifiuta una quota il cui ambito appartiene a un altro evento", async () => {
        const first = await createEventScenario();
        const second = await createEventScenario();

        expect(await message(() => service.save(godId, {
            eventId: first.event.id,
            scope: QuotaScope.SESSION,
            scopeId: second.sessionIds[0]!,
            limit: 30,
        } as never))).toContain("non appartiene a questo evento");
    });

    it("non esistono due quote per la stessa cosa, nemmeno con tutti i riferimenti nulli", async () => {
        const scenario = await createEventScenario();

        await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 220 });

        // In PostgreSQL un indice unico tratta ogni NULL come distinto: senza
        // `NULLS NOT DISTINCT` due quote di capienza della sala coesisterebbero, e
        // una delle due non sarebbe MAI applicata — capienza non controllata.
        const duplicate = await message(() => createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 300,
        }));
        expect(duplicate).not.toBe("OK");

        // Il contingente accrediti, invece, DEVE poter coesistere: è la stessa
        // terna ma un `reservedFor` diverso (§4.8, ramo accrediti).
        const complimentary = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 10,
            reservedFor: "COMPLIMENTARY",
        });
        expect(complimentary.id).toBeGreaterThan(0);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // `05` §9 — modifica dei limiti
    // ─────────────────────────────────────────────────────────────────────────

    it("aumento del limite: sempre consentito", async () => {
        const scenario = await createEventScenario();
        const quota = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 100,
            consumed: 40,
        });

        const updated = await service.updateById(godId, quota.id, { limit: 150 } as never);
        expect(updated.limit).toBe(150);
        expect(updated.consumed).toBe(40);
    });

    it("riduzione a un valore ≥ consumed: consentita", async () => {
        const scenario = await createEventScenario();
        const quota = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 100,
            consumed: 40,
        });

        const updated = await service.updateById(godId, quota.id, { limit: 40 } as never);
        expect(updated.limit).toBe(40);
    });

    /**
     * ⚠︎ CONTRADDIZIONE INTERNA A `05`, DA PORTARE AL COMMITTENTE.
     *
     * - §9 (tabella normativa): riduzione sotto il consumato → **«Ammessa, con
     *   avviso. La disponibilità online va a zero e la vendita si chiude; nessun
     *   biglietto già emesso viene invalidato e nessuno viene espulso»**.
     * - §13 T16 (casistica): «Riduzione del limite leader da 110 a 100 con 105
     *   consumati → **Rifiutata**, con proposta di chiusura a 105».
     *
     * Le due cose non possono essere entrambe vere. Qui vale il §9, che è la
     * regola, e T16 è asserito **nella forma del §9**: nessun biglietto emesso
     * viene invalidato e nessuno viene espulso, che è l'invariante che entrambe
     * le formulazioni vogliono davvero proteggere.
     */
    it("T16 (§9) — riduzione sotto il consumato: AMMESSA, nessun iscritto espulso", async () => {
        const scenario = await createEventScenario();
        const leader = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            role: DanceRole.LEADER,
            limit: 110,
            consumed: 105,
        });

        const updated = await service.updateById(godId, leader.id, { limit: 100 } as never);

        expect(updated.limit).toBe(100);
        // Il consumato non si tocca: la vendita si chiude, la sala resta piena.
        expect(updated.consumed).toBe(105);
    });

    it("da non limitante a limitante con consumed oltre il limite: RIFIUTATA", async () => {
        const scenario = await createEventScenario();
        const quota = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SESSION,
            scopeId: scenario.sessionIds[0]!,
            limit: 10,
            consumed: 14,
            limiting: false,
        });

        expect(await message(() => service.updateById(godId, quota.id, { limiting: true } as never)))
            .toContain("non può diventare limitante");
    });

    it("eliminazione di una quota con consumed > 0: RIFIUTATA, si può solo chiudere", async () => {
        const scenario = await createEventScenario();
        const quota = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 100,
            consumed: 1,
        });

        expect(await message(() => service.safeDeleteById(godId, quota.id)))
            .toContain("non può essere eliminata");

        const stored = await getPrismaClient().capacityQuota.findUniqueOrThrow({ where: { id: quota.id } });
        expect(stored.deleted).toBe(false);
    });

    it("la capienza della sala in anagrafica è PROPOSTA, non imposta", async () => {
        const scenario = await createEventScenario();

        // La sala dichiara 220 posti: il servizio lo propone…
        expect(await service.suggestRoomCapacity(godId, scenario.event.id)).toBe(220);
        // …ma finché nessuno crea la quota, non esiste alcun vincolo.
        const quotas = await getPrismaClient().capacityQuota.count({ where: { eventId: scenario.event.id } });
        expect(quotas).toBe(0);
    });
});
