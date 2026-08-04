import { configureServiceTest } from "fastify-decorators/testing";
import { DanceRole, PassIssuanceReason, QuotaScope, RegistrationChannel } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { PassIssuanceService } from "@services/PassIssuanceService";
import { createEventScenario, createQuota, createRoleQuotas, readConsumed } from "../fixtures/capacity";

/**
 * # L'emissione manuale di pass — `RB20`, `RF-TCK-14`, `RF-TCK-15`
 *
 * La regola che questa suite difende è controintuitiva e va protetta proprio per
 * questo: **l'emissione manuale non è mai bloccata dalle quote**. Si registra il
 * consumo, si restituisce un avviso, e si procede.
 *
 * Il motivo non è di comodità. La responsabilità della sala è
 * dell'organizzatore, che sta emettendo un accredito conoscendo la propria
 * porta; un rifiuto qui non impedirebbe a quella persona di entrare — la farebbe
 * entrare **fuori dal sistema**, cioè cancellerebbe l'unico dato che il sistema
 * poteva ancora produrre.
 */
describe("PassIssuanceService — RB20: avviso, mai blocco", () => {
    let passes: PassIssuanceService;
    let godId: number;

    beforeAll(async () => {
        passes = await configureServiceTest({ service: PassIssuanceService });
        const god = await getPrismaClient().user.findFirstOrThrow({ where: { username: "god" } });
        godId = god.id;
    });

    it("RB20 — l'emissione OLTRE la capienza della sala è ACCETTATA, con avviso", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 10,
            consumed: 9,
        });

        // Cinque accrediti su un posto residuo: una vendita online sarebbe
        // rifiutata con `SOLD_OUT`, questa no.
        const result = await passes.issueBulk(godId, scenario.event.id, {
            ticketTypeId: scenario.ticketTypeId,
            quantity: 5,
            reason: PassIssuanceReason.COMPLIMENTARY,
            nominal: false,
        });

        expect(result.tickets).toHaveLength(5);
        expect(result.passIssuance.quantity).toBe(5);

        // Il contatore si è mosso davvero: il consumo è registrato, non ignorato.
        expect(await readConsumed(room.id)).toBe(14);

        // E l'avviso nomina la quota, il limite e di quanto è stato superato.
        const warning = result.warnings.find(w => w.quotaId === room.id);
        expect(warning).toBeTruthy();
        expect(warning!.limit).toBe(10);
        expect(warning!.consumed).toBe(14);
        expect(warning!.exceededBy).toBe(4);
        expect(warning!.scopeLabel).toBe("Capienza della sala");
    });

    it("l'emissione entro la capienza non produce alcun avviso", async () => {
        const scenario = await createEventScenario();
        await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100, consumed: 0 });

        const result = await passes.issueBulk(godId, scenario.event.id, {
            ticketTypeId: scenario.ticketTypeId,
            quantity: 3,
            reason: PassIssuanceReason.GIFT,
            nominal: false,
        });

        expect(result.warnings).toHaveLength(0);
        expect(result.tickets).toHaveLength(3);
    });

    it("RF-TCK-15 — su un evento con quote per ruolo il RUOLO È OBBLIGATORIO", async () => {
        const scenario = await createEventScenario();
        await createRoleQuotas({ eventId: scenario.event.id, leaderLimit: 50, followerLimit: 50 });

        await expect(
            passes.issueBulk(godId, scenario.event.id, {
                ticketTypeId: scenario.ticketTypeId,
                quantity: 2,
                reason: PassIssuanceReason.COMPLIMENTARY,
                nominal: false,
            }),
        ).rejects.toMatchObject({ statusCode: 400 });

        // Con il ruolo, l'emissione passa e il contatore del ruolo si muove.
        const result = await passes.issueBulk(godId, scenario.event.id, {
            ticketTypeId: scenario.ticketTypeId,
            quantity: 2,
            reason: PassIssuanceReason.COMPLIMENTARY,
            role: DanceRole.FOLLOWER,
            nominal: false,
        });
        expect(result.tickets).toHaveLength(2);

        const followerQuota = await getPrismaClient().capacityQuota.findFirstOrThrow({
            where: { eventId: scenario.event.id, role: DanceRole.FOLLOWER },
        });
        expect(followerQuota.consumed).toBe(2);
    });

    it("i pass in blocco senza nominativo sono AL PORTATORE e non hanno email", async () => {
        const scenario = await createEventScenario();

        const result = await passes.issueBulk(godId, scenario.event.id, {
            ticketTypeId: scenario.ticketTypeId,
            quantity: 2,
            reason: PassIssuanceReason.EXTERNAL_SALE,
            nominal: false,
        });

        for (const ticket of result.tickets) {
            expect(ticket.bearer).toBe(true);
            expect(ticket.holderEmail).toBeNull();
        }
        expect(result.passIssuance.nominal).toBe(false);
    });

    it("l'emissione nominale pretende un nominativo per ogni pass", async () => {
        const scenario = await createEventScenario();

        await expect(
            passes.issueBulk(godId, scenario.event.id, {
                ticketTypeId: scenario.ticketTypeId,
                quantity: 3,
                reason: PassIssuanceReason.COURTESY,
                nominal: true,
                holders: [{ name: "Anna", surname: "Rossi" }],
            }),
        ).rejects.toMatchObject({ statusCode: 400 });

        const ok = await passes.issueBulk(godId, scenario.event.id, {
            ticketTypeId: scenario.ticketTypeId,
            quantity: 2,
            reason: PassIssuanceReason.COURTESY,
            nominal: true,
            holders: [
                { name: "Anna", surname: "Rossi", email: "anna@test.it" },
                { name: "Marco", surname: "Bianchi" },
            ],
        });

        expect(ok.tickets.map(t => t.holderName)).toEqual(["Anna", "Marco"]);
        expect(ok.tickets.every(t => t.bearer === false)).toBe(true);
    });

    it("gli accrediti consumano la sala ma NON l'inventario commerciale del titolo", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });
        const ticketTypeQuota = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.TICKET_TYPE,
            scopeId: scenario.ticketTypeId,
            limit: 50,
        });

        await passes.issueBulk(godId, scenario.event.id, {
            ticketTypeId: scenario.ticketTypeId,
            quantity: 4,
            reason: PassIssuanceReason.COMPLIMENTARY,
            nominal: false,
        });

        // Un ospite non pagante occupa comunque spazio in pista…
        expect(await readConsumed(room.id)).toBe(4);
        // …ma non toglie un biglietto dall'inventario in vendita (§4.8).
        expect(await readConsumed(ticketTypeQuota.id)).toBe(0);

        const registrations = await getPrismaClient().registration.findMany({
            where: { eventId: scenario.event.id },
        });
        expect(registrations.every(r => r.channel === RegistrationChannel.COMPLIMENTARY)).toBe(true);
    });

    it("la revoca dell'emissione annulla i biglietti e RILASCIA i consumi", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({ eventId: scenario.event.id, scope: QuotaScope.EVENT, limit: 100 });

        const issued = await passes.issueBulk(godId, scenario.event.id, {
            ticketTypeId: scenario.ticketTypeId,
            quantity: 3,
            reason: PassIssuanceReason.GIFT,
            nominal: false,
        });
        expect(await readConsumed(room.id)).toBe(3);

        await passes.safeDeleteById(godId, issued.passIssuance.id);

        expect(await readConsumed(room.id)).toBe(0);
        const tickets = await getPrismaClient().ticket.findMany({
            where: { passIssuanceId: issued.passIssuance.id },
        });
        expect(tickets.every(t => t.status === "CANCELLED" && t.qrRevokedAt !== null)).toBe(true);
    });
});
