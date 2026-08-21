import { configureServiceTest } from "fastify-decorators/testing";
import { DanceRole, DeclaredDanceRole, QuotaScope, RegistrationChannel } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { isDomainError } from "@utils/helpers/domainError";
import { DomainErrorCode } from "@enums/DomainErrorCode";
import { CapacityEngineService } from "@services/CapacityEngineService";
import {
    cancelAllAvailabilityWindows,
    pendingAvailabilityWindows,
} from "@services/AvailabilityBroadcastService";
import {
    countConsumptions,
    createEventScenario,
    createQuota,
    createRegistration,
    createRoleQuotas,
    readConsumed,
} from "../fixtures/capacity";

/**
 * # Il collaudo del motore di capienza
 *
 * Automatizza la casistica di `05-modello-capienza.md` §13 e le invarianti del
 * §12, su un **Postgres reale** — mai su mock. L'oggetto sotto collaudo è
 * l'aggiornamento condizionato del database sotto lock: un mock lo riprodurrebbe
 * sempre corretto e mai come si comporta davvero.
 *
 * `13-primo-taglio.md` §8 chiede che questo componente si costruisca per primo e
 * **si collaudi prima di avere un'interfaccia**: qui non c'è una sola chiamata
 * HTTP, un permesso o un DTO. C'è solo l'algoritmo.
 */
describe("CapacityEngineService — casistica di 05-modello-capienza §13", () => {
    let engine: CapacityEngineService;

    /** Codice di dominio dell'errore, o `null` se l'operazione è andata a buon fine. */
    const outcomeOf = async (fn: () => Promise<unknown>): Promise<DomainErrorCode | "OK" | string> => {
        try {
            await fn();
            return "OK";
        } catch (err) {
            return isDomainError(err) ? err.domainCode : `UNEXPECTED: ${(err as Error).message}`;
        }
    };

    beforeAll(async () => {
        engine = await configureServiceTest({ service: CapacityEngineService });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // T1 · T2 · T3 — la milonga senza quote di ruolo
    // ═════════════════════════════════════════════════════════════════════════

    it("T1 — 119 su 120, acquisto di 1 posto: ammesso, contatore a 120", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 120,
            consumed: 119,
        });

        const registration = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.LEADER,
        });

        const outcome = await engine.commit(scenario.event.id, [{ registrationId: registration.id }]);

        expect(outcome.committed).toHaveLength(1);
        expect(await readConsumed(room.id)).toBe(120);
        expect(await countConsumptions(room.id)).toBe(1);
    });

    it("T2 — 120 su 120: rifiutato con motivo SOLD_OUT", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 120,
            consumed: 120,
        });

        const registration = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.LEADER,
        });

        expect(await outcomeOf(() => engine.commit(scenario.event.id, [{ registrationId: registration.id }])))
            .toBe(DomainErrorCode.SOLD_OUT);

        // Il contatore non si muove di un'unità, e nessuna riga di consumo resta orfana.
        expect(await readConsumed(room.id)).toBe(120);
        expect(await countConsumptions(room.id)).toBe(0);
    });

    it("T3 — un residuo, ordine da 2 posti: rifiutato INTERAMENTE, nessun consumo parziale", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 120,
            consumed: 119,
        });

        const first = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
        const second = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.FOLLOWER });

        expect(await outcomeOf(() => engine.commit(scenario.event.id, [
            { registrationId: first.id },
            { registrationId: second.id },
        ]))).toBe(DomainErrorCode.SOLD_OUT);

        expect(await readConsumed(room.id)).toBe(119);
        expect(await countConsumptions(room.id)).toBe(0);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // T4 · T5 · T6 · T7 — il cancello di tolleranza
    // ═════════════════════════════════════════════════════════════════════════

    it("T4 — 110/110 tolleranza 5, stato 40 L e 35 F, un leader singolo: ROLE_ON_HOLD", async () => {
        const scenario = await createEventScenario();
        await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 110,
            followerLimit: 110,
            leaderConsumed: 40,
            followerConsumed: 35,
            tolerance: 5,
        });

        const leader = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });

        expect(await outcomeOf(() => engine.commit(scenario.event.id, [{ registrationId: leader.id }])))
            .toBe(DomainErrorCode.ROLE_ON_HOLD);
    });

    it("T5 — stesso stato, un follower singolo: ammesso", async () => {
        const scenario = await createEventScenario();
        const quotas = await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 110,
            followerLimit: 110,
            leaderConsumed: 40,
            followerConsumed: 35,
            tolerance: 5,
        });

        const follower = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.FOLLOWER });

        await engine.commit(scenario.event.id, [{ registrationId: follower.id }]);

        expect(await readConsumed(quotas.follower.id)).toBe(36);
        expect(await readConsumed(quotas.leader.id)).toBe(40);
    });

    it("T6 — stesso stato, una coppia: ammessa, lo sbilancio non cambia", async () => {
        const scenario = await createEventScenario();
        const quotas = await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 110,
            followerLimit: 110,
            leaderConsumed: 40,
            followerConsumed: 35,
            tolerance: 5,
        });

        // Una coppia è semplicemente un ordine con due iscrizioni di ruolo
        // complementare: nel motore NON esiste codice dedicato alle coppie.
        const leader = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
        const follower = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.FOLLOWER });

        await engine.commit(scenario.event.id, [
            { registrationId: leader.id },
            { registrationId: follower.id },
        ]);

        const leaderConsumed = await readConsumed(quotas.leader.id);
        const followerConsumed = await readConsumed(quotas.follower.id);

        expect(leaderConsumed).toBe(41);
        expect(followerConsumed).toBe(36);
        // Proprietà notevole: lo sbilancio è invariato, quindi il cancello è superato.
        expect(leaderConsumed - followerConsumed).toBe(5);
    });

    it("T7 — limite leader 60, stato 60 L e 55 F: SOLD_OUT, non ROLE_ON_HOLD", async () => {
        const scenario = await createEventScenario();
        await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 60,
            followerLimit: 60,
            leaderConsumed: 60,
            followerConsumed: 55,
            tolerance: 5,
        });

        const leader = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });

        // I due rifiuti hanno significati OPPOSTI: `SOLD_OUT` è definitivo,
        // `ROLE_ON_HOLD` si può sbloccare. Confonderli è un difetto di prodotto.
        expect(await outcomeOf(() => engine.commit(scenario.event.id, [{ registrationId: leader.id }])))
            .toBe(DomainErrorCode.SOLD_OUT);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // La tabella di esempio del `05` §6 — limiti 60/60, tolleranza 5
    // ═════════════════════════════════════════════════════════════════════════

    describe("`05` §6 — tabella del cancello di tolleranza (60/60, tolleranza 5)", () => {
        const attempt = async (
            leaderConsumed: number,
            followerConsumed: number,
            roles: DeclaredDanceRole[],
        ): Promise<string> => {
            const scenario = await createEventScenario();
            await createRoleQuotas({
                eventId: scenario.event.id,
                leaderLimit: 60,
                followerLimit: 60,
                leaderConsumed,
                followerConsumed,
                tolerance: 5,
            });

            const registrations: { id: number }[] = [];
            for (const role of roles) {
                registrations.push(await createRegistration({ eventId: scenario.event.id, declaredRole: role }));
            }

            return outcomeOf(() => engine.commit(
                scenario.event.id,
                registrations.map(r => ({ registrationId: r.id })),
            ));
        };

        const LEADER = [DeclaredDanceRole.LEADER];
        const FOLLOWER = [DeclaredDanceRole.FOLLOWER];
        const COUPLE = [DeclaredDanceRole.LEADER, DeclaredDanceRole.FOLLOWER];

        it("40 L / 38 F — leader ammesso (sbilancio 3), follower ammesso, coppia ammessa", async () => {
            expect(await attempt(40, 38, LEADER)).toBe("OK");
            expect(await attempt(40, 38, FOLLOWER)).toBe("OK");
            expect(await attempt(40, 38, COUPLE)).toBe("OK");
        });

        it("40 L / 35 F — leader RIFIUTATO (sbilancio già a 5), follower ammesso, coppia ammessa", async () => {
            expect(await attempt(40, 35, LEADER)).toBe(DomainErrorCode.ROLE_ON_HOLD);
            expect(await attempt(40, 35, FOLLOWER)).toBe("OK");
            expect(await attempt(40, 35, COUPLE)).toBe("OK");
        });

        it("58 L / 58 F — leader ammesso, follower ammesso, coppia ammessa", async () => {
            expect(await attempt(58, 58, LEADER)).toBe("OK");
            expect(await attempt(58, 58, FOLLOWER)).toBe("OK");
            expect(await attempt(58, 58, COUPLE)).toBe("OK");
        });

        it("60 L / 55 F — leader rifiutato per LIMITE ASSOLUTO, follower ammesso, coppia rifiutata (leader saturo)", async () => {
            expect(await attempt(60, 55, LEADER)).toBe(DomainErrorCode.SOLD_OUT);
            expect(await attempt(60, 55, FOLLOWER)).toBe("OK");
            expect(await attempt(60, 55, COUPLE)).toBe(DomainErrorCode.SOLD_OUT);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // T8 · T9 — il ruolo flessibile
    // ═════════════════════════════════════════════════════════════════════════

    it("T8 — flessibile con 40 L e 35 F: assegnato FOLLOWER", async () => {
        const scenario = await createEventScenario();
        await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 110,
            followerLimit: 110,
            leaderConsumed: 40,
            followerConsumed: 35,
        });

        expect(await engine.resolveFlexible(scenario.event.id)).toBe(DanceRole.FOLLOWER);

        const registration = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.FLEXIBLE,
        });
        const outcome = await engine.commit(scenario.event.id, [{ registrationId: registration.id }]);

        expect(outcome.committed[0]!.assignedRole).toBe(DanceRole.FOLLOWER);

        const stored = await getPrismaClient().registration.findUniqueOrThrow({ where: { id: registration.id } });
        expect(stored.assignedRole).toBe(DanceRole.FOLLOWER);
    });

    it("T9 — flessibile con quote e consumi identici: assegnato LEADER, in modo deterministico", async () => {
        const scenario = await createEventScenario();
        await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 110,
            followerLimit: 110,
            leaderConsumed: 42,
            followerConsumed: 42,
        });

        // La convenzione esiste per il determinismo: dieci chiamate, dieci LEADER.
        for (let i = 0; i < 10; i += 1) {
            expect(await engine.resolveFlexible(scenario.event.id)).toBe(DanceRole.LEADER);
        }
    });

    // ═════════════════════════════════════════════════════════════════════════
    // T10 · T11 — la sessione inclusa nel pass
    // ═════════════════════════════════════════════════════════════════════════

    it("T10 — Full Pass con sessione LIMITANTE satura per il ruolo: SOLD_OUT, con nome sessione e ruolo", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        await createRoleQuotas({ eventId: scenario.event.id, leaderLimit: 100, followerLimit: 100 });
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SESSION,
            scopeId: scenario.sessionIds[1]!,
            role: DanceRole.FOLLOWER,
            limit: 25,
            consumed: 25,
            limiting: true,
        });

        const follower = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.FOLLOWER,
        });

        try {
            await engine.commit(scenario.event.id, [
                { registrationId: follower.id, ticketTypeId: scenario.ticketTypeId },
            ]);
            throw new Error("il commit doveva essere rifiutato");
        } catch (err) {
            expect(isDomainError(err)).toBe(true);
            if (!isDomainError(err)) return;
            expect(err.domainCode).toBe(DomainErrorCode.SOLD_OUT);
            // `RF-PAY-16` — bisogna NOMINARE la sessione e il ruolo.
            expect(err.payload).toMatchObject({
                scope: QuotaScope.SESSION,
                scopeId: scenario.sessionIds[1],
                role: DanceRole.FOLLOWER,
            });
            expect(err.payload!.scopeLabel).toBe("Sessione 2");
        }
    });

    it("T11 — Full Pass con sessione NON limitante satura: ammesso, il contatore supera il limite", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        const milonga = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SESSION,
            scopeId: scenario.sessionIds[0]!,
            limit: 10,
            consumed: 10,
            limiting: false,
        });

        const registration = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.LEADER,
        });

        await engine.commit(scenario.event.id, [
            { registrationId: registration.id, ticketTypeId: scenario.ticketTypeId },
        ]);

        // La quota CONTA e non BLOCCA: il contatore sfora, e sarà il cruscotto a dirlo.
        expect(await readConsumed(milonga.id)).toBe(11);
        expect(await countConsumptions(milonga.id)).toBe(1);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // T12 — disponibilità parziale in checkout
    // ═════════════════════════════════════════════════════════════════════════

    it("T12 — cena esaurita, titolo disponibile: PARTIAL_AVAILABILITY, non un rifiuto dell'ordine", async () => {
        const scenario = await createEventScenario();
        await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 200 });
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 150,
        });
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SERVICE,
            scopeId: scenario.serviceId,
            limit: 90,
            consumed: 90,
        });

        const registration = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.LEADER,
        });

        try {
            await engine.commit(scenario.event.id, [{
                registrationId: registration.id,
                ticketTypeId: scenario.ticketTypeId,
                serviceIds: [scenario.serviceId],
            }]);
            throw new Error("il commit doveva segnalare la disponibilità parziale");
        } catch (err) {
            expect(isDomainError(err)).toBe(true);
            if (!isDomainError(err)) return;
            // Non si fa fallire un'iscrizione da 90 euro per una cena da 25.
            expect(err.domainCode).toBe(DomainErrorCode.PARTIAL_AVAILABILITY);
            expect(err.payload!.unavailable).toMatchObject([
                { scope: QuotaScope.SERVICE, scopeId: scenario.serviceId, scopeLabel: "Cena di gala" },
            ]);
        }
    });

    // ═════════════════════════════════════════════════════════════════════════
    // T13 · T21 — il rilascio esatto
    // ═════════════════════════════════════════════════════════════════════════

    it("T13 — rimborso di un'iscrizione con pass, 4 sessioni e cena: contatori decrementati ESATTAMENTE, righe cancellate", async () => {
        const scenario = await createEventScenario({ sessions: 4 });

        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 200, consumed: 50 });
        const pass = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 150,
            consumed: 30,
        });
        const sessionQuotas: { id: number }[] = [];
        for (const sessionId of scenario.sessionIds) {
            sessionQuotas.push(await createQuota({
                eventId: scenario.event.id,
                scope: QuotaScope.SESSION,
                scopeId: sessionId,
                limit: 100,
                consumed: 10,
            }));
        }
        const dinner = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SERVICE,
            scopeId: scenario.serviceId,
            limit: 90,
            consumed: 20,
        });

        const registration = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.LEADER,
        });

        const outcome = await engine.commit(scenario.event.id, [{
            registrationId: registration.id,
            ticketTypeId: scenario.ticketTypeId,
            serviceIds: [scenario.serviceId],
        }]);

        // Sala + titolo + 4 sessioni + cena = SETTE contatori.
        //
        // NOTA — `05` §13 T13 dice «sei contatori»: il conto del documento non
        // include la capienza della sala, che il §4 mette invece fra le quote
        // applicabili «sempre». Sette è il numero corretto per QUESTO scenario,
        // e ciò che il caso verifica davvero è che il rilascio tocchi
        // ESATTAMENTE i contatori impegnati — né uno di più, né uno di meno.
        expect(outcome.committed[0]!.quotaIds).toHaveLength(7);
        expect(await readConsumed(room.id)).toBe(51);
        expect(await readConsumed(pass.id)).toBe(31);
        expect(await readConsumed(dinner.id)).toBe(21);

        const release = await engine.release(registration.id);

        expect(release.releasedQuantity).toBe(7);
        expect(release.deletedConsumptions).toBe(7);
        expect(release.releasedQuotaIds).toHaveLength(7);
        expect(await readConsumed(room.id)).toBe(50);
        expect(await readConsumed(pass.id)).toBe(30);
        expect(await readConsumed(dinner.id)).toBe(20);
        for (const quota of sessionQuotas) {
            expect(await readConsumed(quota.id)).toBe(10);
            expect(await countConsumptions(quota.id)).toBe(0);
        }
    });

    it("Rilascio di UN SOLO componente della coppia: l'altra iscrizione resta intatta", async () => {
        const scenario = await createEventScenario();
        const quotas = await createRoleQuotas({ eventId: scenario.event.id, leaderLimit: 60, followerLimit: 60 });
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 200 });

        const couple = await getPrismaClient().couple.create({ data: { eventId: scenario.event.id } });
        const leader = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.LEADER,
            coupleId: couple.id,
        });
        const follower = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.FOLLOWER,
            coupleId: couple.id,
        });

        await engine.commit(scenario.event.id, [
            { registrationId: leader.id },
            { registrationId: follower.id },
        ]);
        expect(await readConsumed(room.id)).toBe(2);

        await engine.release(leader.id);

        expect(await readConsumed(room.id)).toBe(1);
        expect(await readConsumed(quotas.leader.id)).toBe(0);
        expect(await readConsumed(quotas.follower.id)).toBe(1);
        expect(await countConsumptions(quotas.follower.id)).toBe(1);
    });

    it("T21 — scioglimento della coppia senza rinuncia: NESSUN movimento sui contatori", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 200 });

        const couple = await getPrismaClient().couple.create({ data: { eventId: scenario.event.id } });
        const leader = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.LEADER,
            coupleId: couple.id,
        });
        const follower = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.FOLLOWER,
            coupleId: couple.id,
        });

        await engine.commit(scenario.event.id, [
            { registrationId: leader.id },
            { registrationId: follower.id },
        ]);

        // Lo scioglimento è un fatto di legame, non di capienza: il motore non
        // viene nemmeno chiamato.
        await getPrismaClient().couple.update({ where: { id: couple.id }, data: { dissolvedAt: new Date() } });
        await getPrismaClient().registration.updateMany({
            where: { coupleId: couple.id },
            data: { coupleId: null },
        });

        expect(await readConsumed(room.id)).toBe(2);
        expect(await countConsumptions(room.id)).toBe(2);
    });

    it("Scadenza della prenotazione: rilascio dell'impegno tecnico, posto di nuovo acquistabile (T17d)", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 1 });

        const abandoned = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
        await engine.commit(scenario.event.id, [{ registrationId: abandoned.id }]);
        expect(await readConsumed(room.id)).toBe(1);

        const other = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.FOLLOWER });
        expect(await outcomeOf(() => engine.commit(scenario.event.id, [{ registrationId: other.id }])))
            .toBe(DomainErrorCode.SOLD_OUT);

        // Il recupero delle prenotazioni scadute passa dallo stesso rilascio esatto.
        await engine.release(abandoned.id);
        expect(await readConsumed(room.id)).toBe(0);

        await engine.commit(scenario.event.id, [{ registrationId: other.id }]);
        expect(await readConsumed(room.id)).toBe(1);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // T14 · T15 — il trasferimento del biglietto
    // ═════════════════════════════════════════════════════════════════════════

    it("T14 — trasferimento con ruolo diverso e nuovo ruolo saturo: rifiutato, NESSUN contatore modificato", async () => {
        const scenario = await createEventScenario();
        const quotas = await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 60,
            followerLimit: 30,
            followerConsumed: 30,
        });
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 200 });

        const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
        await engine.commit(scenario.event.id, [{ registrationId: registration.id }]);

        const before = {
            leader: await readConsumed(quotas.leader.id),
            follower: await readConsumed(quotas.follower.id),
            room: await readConsumed(room.id),
        };

        expect(await outcomeOf(() => engine.reassignRole(registration.id, DanceRole.FOLLOWER)))
            .toBe(DomainErrorCode.SOLD_OUT);

        // Rilascio del vecchio e impegno del nuovo NELLA STESSA TRANSAZIONE:
        // il rifiuto annulla anche il rilascio, e nulla cambia.
        expect(await readConsumed(quotas.leader.id)).toBe(before.leader);
        expect(await readConsumed(quotas.follower.id)).toBe(before.follower);
        expect(await readConsumed(room.id)).toBe(before.room);

        const stored = await getPrismaClient().registration.findUniqueOrThrow({ where: { id: registration.id } });
        expect(stored.assignedRole).toBe(DanceRole.LEADER);
    });

    it("T15 — trasferimento a parità di ruolo: contatori invariati", async () => {
        const scenario = await createEventScenario();
        const quotas = await createRoleQuotas({ eventId: scenario.event.id, leaderLimit: 60, followerLimit: 60 });

        const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
        await engine.commit(scenario.event.id, [{ registrationId: registration.id }]);

        await engine.reassignRole(registration.id, DanceRole.LEADER);

        expect(await readConsumed(quotas.leader.id)).toBe(1);
        expect(await readConsumed(quotas.follower.id)).toBe(0);
        expect(await countConsumptions(quotas.leader.id)).toBe(1);
    });

    it("Trasferimento con ruolo diverso e posto disponibile: rilascio del vecchio e impegno del nuovo", async () => {
        const scenario = await createEventScenario();
        const quotas = await createRoleQuotas({ eventId: scenario.event.id, leaderLimit: 60, followerLimit: 60 });
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 200 });

        const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
        await engine.commit(scenario.event.id, [{ registrationId: registration.id }]);

        await engine.reassignRole(registration.id, DanceRole.FOLLOWER);

        expect(await readConsumed(quotas.leader.id)).toBe(0);
        expect(await readConsumed(quotas.follower.id)).toBe(1);
        // La capienza della sala non si muove: la persona è sempre una.
        expect(await readConsumed(room.id)).toBe(1);
        expect(await countConsumptions(room.id)).toBe(1);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // T17 · T17b · T18 — concorrenza, sforamento, idempotenza
    // ═════════════════════════════════════════════════════════════════════════

    it("T17 — due pagamenti concorrenti sull'ultimo posto: un solo impegno riesce", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 1 });

        const first = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
        const second = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.FOLLOWER });

        const results = await Promise.allSettled([
            engine.commit(scenario.event.id, [{ registrationId: first.id }]),
            engine.commit(scenario.event.id, [{ registrationId: second.id }]),
        ]);

        expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
        expect(await readConsumed(room.id)).toBe(1);
        expect(await countConsumptions(room.id)).toBe(1);
    });

    it("T17b — quota commerciale al limite con overbookAllowance 2: due acquisti ammessi, il terzo rifiutato", async () => {
        const scenario = await createEventScenario();
        const pass = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 50,
            consumed: 50,
            overbookAllowance: 2,
        });

        for (const expected of [51, 52]) {
            const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
            await engine.commit(scenario.event.id, [
                { registrationId: registration.id, ticketTypeId: scenario.ticketTypeId },
            ]);
            expect(await readConsumed(pass.id)).toBe(expected);
        }

        const third = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
        expect(await outcomeOf(() => engine.commit(scenario.event.id, [
            { registrationId: third.id, ticketTypeId: scenario.ticketTypeId },
        ]))).toBe(DomainErrorCode.SOLD_OUT);

        expect(await readConsumed(pass.id)).toBe(52);
    });

    it("T18 — doppia notifica del prestatore sullo stesso ordine: contatori invariati al secondo tentativo", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 200 });

        const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });

        await engine.commit(scenario.event.id, [{ registrationId: registration.id }]);
        expect(await readConsumed(room.id)).toBe(1);

        const replay = await engine.commit(scenario.event.id, [{ registrationId: registration.id }]);

        expect(replay.committed).toHaveLength(0);
        expect(replay.alreadyCommitted).toEqual([registration.id]);
        expect(await readConsumed(room.id)).toBe(1);
        expect(await countConsumptions(room.id)).toBe(1);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // T19 · T22 — accrediti e assenza di quote
    // ═════════════════════════════════════════════════════════════════════════

    it("T19 — accredito staff: consuma quota accrediti, capienza sala e quota di ruolo; NON la quota di titolo", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 200 });
        const quotas = await createRoleQuotas({ eventId: scenario.event.id, leaderLimit: 110, followerLimit: 110 });
        const pass = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 150,
        });
        const complimentary = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 10,
            reservedFor: "COMPLIMENTARY",
        });

        const guest = await createRegistration({
            eventId: scenario.event.id,
            declaredRole: DeclaredDanceRole.LEADER,
            channel: RegistrationChannel.COMPLIMENTARY,
        });

        await engine.commit(scenario.event.id, [
            { registrationId: guest.id, ticketTypeId: scenario.ticketTypeId },
        ]);

        expect(await readConsumed(complimentary.id)).toBe(1);
        expect(await readConsumed(room.id)).toBe(1);
        expect(await readConsumed(quotas.leader.id)).toBe(1);
        // L'inventario commerciale non si tocca: un ospite non pagante occupa
        // spazio in pista, non un biglietto in vendita.
        expect(await readConsumed(pass.id)).toBe(0);
    });

    it("T22 — evento senza alcuna quota configurata: vendita senza limiti, nessun errore", async () => {
        const scenario = await createEventScenario();

        for (let i = 0; i < 5; i += 1) {
            const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.FLEXIBLE });
            const outcome = await engine.commit(scenario.event.id, [
                { registrationId: registration.id, ticketTypeId: scenario.ticketTypeId },
            ]);
            expect(outcome.committed[0]!.quotaIds).toHaveLength(0);
            // Senza quote di ruolo il flessibile resta senza ruolo assegnato: non
            // c'è alcuna dimensione su cui assegnarlo.
            expect(outcome.committed[0]!.assignedRole).toBeNull();
        }

        expect(await getPrismaClient().quotaConsumption.count()).toBeGreaterThanOrEqual(0);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // T23 — CINQUANTA ACQUISTI SIMULTANEI SU DIECI POSTI
    // ═════════════════════════════════════════════════════════════════════════

    it(
        "T23 — cinquanta acquisti SIMULTANEI su dieci posti: esattamente dieci ammessi, quaranta rifiutati SOLD_OUT",
        async () => {
            const scenario = await createEventScenario();
            const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 10 });
            const pass = await createQuota({
                eventId: scenario.event.id,
                scope: QuotaScope.TICKET_TYPE,
                scopeId: scenario.ticketTypeId,
                limit: 10,
            });

            const registrations: { id: number }[] = [];
            for (let i = 0; i < 50; i += 1) {
                registrations.push(await createRegistration({
                    eventId: scenario.event.id,
                    declaredRole: DeclaredDanceRole.LEADER,
                }));
            }

            // CONCORRENZA REALE: cinquanta transazioni parallele contro lo stesso
            // Postgres, non una simulazione. È lo scenario dell'apertura vendite di
            // un evento atteso, e `13-primo-taglio.md` §4 lo vuole automatizzato
            // PRIMA della prima apertura reale.
            const results = await Promise.allSettled(
                registrations.map(registration =>
                    engine.commit(scenario.event.id, [
                        { registrationId: registration.id, ticketTypeId: scenario.ticketTypeId },
                    ]),
                ),
            );

            const accepted = results.filter(r => r.status === "fulfilled");
            const rejected = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
            const soldOut = rejected.filter(r => isDomainError(r.reason) && r.reason.domainCode === DomainErrorCode.SOLD_OUT);
            const other = rejected.filter(r => !isDomainError(r.reason) || r.reason.domainCode !== DomainErrorCode.SOLD_OUT);

            // Diagnostica esplicita: se questo test diventa rosso serve sapere PERCHÉ,
            // non solo che i numeri non tornano.
            if (other.length) {
                throw new Error(
                    `T23: ${other.length} rifiuti non-SOLD_OUT: `
                    + other.map(r => (r.reason as Error).message).join(" | "),
                );
            }

            expect(accepted).toHaveLength(10);
            expect(soldOut).toHaveLength(40);

            // Nessun contatore oltre il limite.
            expect(await readConsumed(room.id)).toBe(10);
            expect(await readConsumed(pass.id)).toBe(10);

            // Nessun consumo orfano: né in eccesso né a fronte di un ordine rifiutato.
            expect(await countConsumptions(room.id)).toBe(10);
            expect(await countConsumptions(pass.id)).toBe(10);

            const report = await engine.verifyInvariants(scenario.event.id);
            expect(report.violations).toEqual([]);
            expect(report.ok).toBe(true);
        },
        120_000,
    );

    // ═════════════════════════════════════════════════════════════════════════
    // Le invarianti del `05` §12
    // ═════════════════════════════════════════════════════════════════════════


    describe("il segnale di disponibilita parte anche dentro la transazione del chiamante", () => {
        /**
         * ── Il difetto che questo blocco tiene chiuso ────────────────────────
         * `event/availability-changed` partiva **solo** dai percorsi in cui il
         * motore apriva la transazione da se. Ma quattordici punti gliela
         * passano — la vendita vera, l'abbandono, la passata delle prenotazioni
         * scadute, l'emissione dei pass, il rifiuto di un'iscrizione,
         * l'annullamento di una sessione, le vendite dei canali esterni — e
         * nessuno di quelli emetteva alcunche.
         *
         * L'evento di punta del tempo reale risultava quindi **quasi mai
         * pubblicato in esercizio**, e non falliva niente: i contatori del
         * cruscotto si muovevano soltanto ricaricando la pagina. La suite
         * passava sia prima sia dopo la correzione, che e esattamente il motivo
         * per cui questo caso deve esistere.
         *
         * Si asserisce sulla **finestra di aggregazione aperta**, non su un
         * frame sul filo: `notify()` non fa I/O, registra un timer, e la
         * finestra e osservabile — `pendingCount()`. Collaudare qui il socket
         * significherebbe collaudare `WsPublisherService`, che ha la sua suite.
         */
        beforeEach(() => {
            cancelAllAvailabilityWindows();
        });

        afterAll(() => {
            cancelAllAvailabilityWindows();
        });

        it("`commit` con una transazione esterna apre comunque la finestra", async () => {
            const scenario = await createEventScenario();
            await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });
            const registration = await createRegistration({
                eventId: scenario.event.id,
                declaredRole: DeclaredDanceRole.LEADER,
            });

            expect(pendingAvailabilityWindows()).toBe(0);

            await getPrismaClient().$transaction(async prisma => {
                await engine.commit(
                    scenario.event.id,
                    [{ registrationId: registration.id, ticketTypeId: scenario.ticketTypeId }],
                    prisma,
                );
            });

            expect(pendingAvailabilityWindows()).toBe(1);
        });

        it("`commitWithoutBlocking` con una transazione esterna apre comunque la finestra", async () => {
            const scenario = await createEventScenario();
            await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });
            const registration = await createRegistration({
                eventId: scenario.event.id,
                declaredRole: DeclaredDanceRole.FOLLOWER,
                channel: RegistrationChannel.EXTERNAL_CHANNEL,
            });

            expect(pendingAvailabilityWindows()).toBe(0);

            await getPrismaClient().$transaction(async prisma => {
                await engine.commitWithoutBlocking(
                    scenario.event.id,
                    [{ registrationId: registration.id, ticketTypeId: scenario.ticketTypeId }],
                    prisma,
                );
            });

            expect(pendingAvailabilityWindows()).toBe(1);
        });

        it("il RILASCIO con una transazione esterna apre comunque la finestra", async () => {
            const scenario = await createEventScenario();
            await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });
            const registration = await createRegistration({
                eventId: scenario.event.id,
                declaredRole: DeclaredDanceRole.LEADER,
            });
            await engine.commit(scenario.event.id, [
                { registrationId: registration.id, ticketTypeId: scenario.ticketTypeId },
            ]);

            cancelAllAvailabilityWindows();
            expect(pendingAvailabilityWindows()).toBe(0);

            await getPrismaClient().$transaction(async prisma => {
                await engine.releaseRegistrations([registration.id], prisma);
            });

            // Un posto che torna libero e un cambiamento di disponibilita quanto
            // uno che si occupa: se il rilascio tacesse, la sala risulterebbe
            // piena fino al ricaricamento della pagina.
            expect(pendingAvailabilityWindows()).toBe(1);
        });
    });

    describe("`05` §12 — invarianti verificate come asserzioni", () => {
        it("I1 — la vendita online non supera mai limit + overbookAllowance, e mai limit sulla capienza della sala", async () => {
            const scenario = await createEventScenario();
            const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 3 });

            for (let i = 0; i < 8; i += 1) {
                const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
                await outcomeOf(() => engine.commit(scenario.event.id, [{ registrationId: registration.id }]));
                const consumed = await readConsumed(room.id);
                // In ogni istante, anche transitorio.
                expect(consumed).toBeLessThanOrEqual(room.limit + room.overbookAllowance);
            }

            expect(await readConsumed(room.id)).toBe(3);
        });

        it("I2 · I3 · I4 · I7 — dopo un ciclo di impegni e rilasci le invarianti reggono", async () => {
            const scenario = await createEventScenario({ sessions: 3 });
            await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });
            await createRoleQuotas({ eventId: scenario.event.id, leaderLimit: 50, followerLimit: 50, tolerance: 5 });
            await createQuota({
                eventId: scenario.event.id,
                scope: QuotaScope.TICKET_TYPE,
                scopeId: scenario.ticketTypeId,
                limit: 80,
            });
            for (const sessionId of scenario.sessionIds) {
                await createQuota({ eventId: scenario.event.id, scope: QuotaScope.SESSION, scopeId: sessionId, limit: 60 });
            }

            const committed: number[] = [];
            for (let i = 0; i < 12; i += 1) {
                const registration = await createRegistration({
                    eventId: scenario.event.id,
                    declaredRole: i % 2 === 0 ? DeclaredDanceRole.LEADER : DeclaredDanceRole.FOLLOWER,
                });
                await engine.commit(scenario.event.id, [
                    { registrationId: registration.id, ticketTypeId: scenario.ticketTypeId },
                ]);
                committed.push(registration.id);
            }

            expect((await engine.verifyInvariants(scenario.event.id)).violations).toEqual([]);

            // Un rimborso ogni tre, poi si ricontrolla.
            for (const registrationId of committed.filter((_, index) => index % 3 === 0)) {
                await engine.release(registrationId);
                await getPrismaClient().registration.update({
                    where: { id: registrationId },
                    data: { status: "DECLINED", declinedAt: new Date() },
                });
            }

            const report = await engine.verifyInvariants(scenario.event.id);
            expect(report.violations).toEqual([]);
            expect(report.ok).toBe(true);
        });

        it("I5 — su eventi con tolleranza configurata |L − F| resta entro la tolleranza", async () => {
            const scenario = await createEventScenario();
            const quotas = await createRoleQuotas({
                eventId: scenario.event.id,
                leaderLimit: 60,
                followerLimit: 60,
                tolerance: 2,
            });

            // Venti tentativi tutti dello stesso ruolo: il cancello deve fermarli.
            for (let i = 0; i < 20; i += 1) {
                const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
                await outcomeOf(() => engine.commit(scenario.event.id, [{ registrationId: registration.id }]));

                const leader = await readConsumed(quotas.leader.id);
                const follower = await readConsumed(quotas.follower.id);
                expect(Math.abs(leader - follower)).toBeLessThanOrEqual(2);
            }

            expect(await readConsumed(quotas.leader.id)).toBe(2);
        });

        it("I6 — nessun QuotaConsumption resta collegato a un'iscrizione rilasciata", async () => {
            const scenario = await createEventScenario();
            await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });

            const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
            await engine.commit(scenario.event.id, [{ registrationId: registration.id }]);
            await engine.release(registration.id);

            const rows = await getPrismaClient().quotaConsumption.count({ where: { registrationId: registration.id } });
            expect(rows).toBe(0);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Rilascio di evento e di sessione
    // ═════════════════════════════════════════════════════════════════════════

    it("Annullamento dell'evento: rilascio di tutto, i contatori tornano a zero", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });
        const sessionQuota = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SESSION,
            scopeId: scenario.sessionIds[0]!,
            limit: 50,
        });

        for (let i = 0; i < 4; i += 1) {
            const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
            await engine.commit(scenario.event.id, [
                { registrationId: registration.id, ticketTypeId: scenario.ticketTypeId },
            ]);
        }

        expect(await readConsumed(room.id)).toBe(4);

        await engine.releaseEvent(scenario.event.id);

        expect(await readConsumed(room.id)).toBe(0);
        expect(await readConsumed(sessionQuota.id)).toBe(0);
        expect(await countConsumptions(room.id)).toBe(0);
    });

    it("Annullamento di UNA sessione: si rilasciano le sole quote di quella sessione", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });
        const first = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SESSION,
            scopeId: scenario.sessionIds[0]!,
            limit: 50,
        });
        const second = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SESSION,
            scopeId: scenario.sessionIds[1]!,
            limit: 50,
        });

        for (let i = 0; i < 3; i += 1) {
            const registration = await createRegistration({ eventId: scenario.event.id, declaredRole: DeclaredDanceRole.LEADER });
            await engine.commit(scenario.event.id, [
                { registrationId: registration.id, ticketTypeId: scenario.ticketTypeId },
            ]);
        }

        await engine.releaseSession(scenario.event.id, scenario.sessionIds[0]!);

        expect(await readConsumed(first.id)).toBe(0);
        // L'evento si svolge regolarmente: tutto il resto resta impegnato.
        expect(await readConsumed(second.id)).toBe(3);
        expect(await readConsumed(room.id)).toBe(3);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Disponibilità pubblica
    // ═════════════════════════════════════════════════════════════════════════

    it("Disponibilità: residuo sulla quota più stretta, soldOut e rolesOnHold coerenti", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100, consumed: 10 });
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 40,
            consumed: 37,
        });
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SESSION,
            scopeId: scenario.sessionIds[0]!,
            limit: 30,
            consumed: 25,
        });
        await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 60,
            followerLimit: 60,
            leaderConsumed: 40,
            followerConsumed: 35,
            tolerance: 5,
        });

        const availability = await engine.availability(scenario.event.id);

        const pass = availability.ticketTypes.find(t => t.id === scenario.ticketTypeId)!;
        expect(pass.remaining).toBe(3);
        expect(pass.soldOut).toBe(false);
        expect(availability.roles).toEqual({ leader: 20, follower: 25 });
        // 40 L e 35 F con tolleranza 5: il leader è momentaneamente sospeso.
        expect(availability.rolesOnHold).toEqual({ leader: true, follower: false });
        expect(availability.imbalance).toBe(5);
        expect(availability.imbalanceTolerance).toBe(5);
        expect(pass.activeTier.price).toBe(9_000);
    });

    it("Disponibilità: una quota non pubblica non appare nel residuo ma vale comunque per il soldOut", async () => {
        const scenario = await createEventScenario();
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 40,
            consumed: 10,
        });
        await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 50,
            consumed: 50,
            publiclyVisible: false,
        });

        const availability = await engine.availability(scenario.event.id);
        const pass = availability.ticketTypes.find(t => t.id === scenario.ticketTypeId)!;

        expect(pass.remaining).toBe(30);
        // L'esaurito è un fatto, non un indicatore: nascondere un numero non può
        // trasformarsi in un biglietto vendibile che non esiste.
        expect(pass.soldOut).toBe(true);
    });
});
