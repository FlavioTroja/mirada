import { configureServiceTest } from "fastify-decorators/testing";
import { BalanceSettlementMethod, DeclaredDanceRole, RegistrationStatus, RoleName } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { BalanceSettlementService } from "@services/BalanceSettlementService";
import { CheckInService } from "@services/CheckInService";
import { createEventScenario } from "../fixtures/capacity";
import { createTicketFor } from "../fixtures/tickets";

/**
 * # L'acconto e il saldo — `14-acconto-e-saldo.md` §6 e §7
 *
 * Questa suite difende quattro cose che, se si rompessero, si scoprirebbero
 * **soltanto a fine serata, con il cassetto in mano**:
 *
 *  1. **Il contatore è la somma delle righe.** `balanceSettledAmount` si muove
 *     solo attraverso questo servizio, e vale sempre quanto le righe che lo
 *     compongono.
 *  2. **Il doppio incasso non si perde.** Due postazioni scollegate che
 *     incassano lo stesso residuo producono due righe, la seconda marcata come
 *     conflitto — mai una riga scartata perché il server preferisce la prima.
 *  3. **`RB25` — un residuo non blocca mai l'ingresso.** L'esito della verifica
 *     resta `VALID`, e accanto compare un avviso.
 *  4. **`RB27` — la cifra è di chi tiene la cassa.** Chi non ha il permesso vede
 *     che un saldo esiste e non quanto vale, perché l'importo **non gli viene
 *     spedito**.
 */
describe("BalanceSettlementService — la cassa del botteghino", () => {
    let balances: BalanceSettlementService;
    let checkIns: CheckInService;
    let operatorId: number;

    beforeAll(async () => {
        balances = await configureServiceTest({ service: BalanceSettlementService });
        checkIns = await configureServiceTest({ service: CheckInService });
        const god = await getPrismaClient().user.findFirstOrThrow({ where: { username: "god" } });
        operatorId = god.id;
    });

    /** Un'iscrizione con un residuo aperto, come la lascia l'ingestione. */
    async function registrationWithBalance(due: number, eventId?: number) {
        const scenario = eventId ? null : await createEventScenario();
        const id = eventId ?? scenario!.event.id;

        const registration = await getPrismaClient().registration.create({
            data: {
                eventId: id,
                holderName: "Giulia",
                holderSurname: "Rossi",
                holderEmail: "giulia@example.it",
                declaredRole: DeclaredDanceRole.FOLLOWER,
                status: RegistrationStatus.CONFIRMED,
                balanceDueAmount: due,
            },
        });

        return { registration, scenario };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Il contatore e le righe
    // ═════════════════════════════════════════════════════════════════════════

    it("il contatore dell'iscrizione vale SEMPRE quanto la somma delle righe", async () => {
        const { registration } = await registrationWithBalance(10_850);

        await balances.save(operatorId, {
            registrationId: registration.id,
            amount: 5_000,
            method: BalanceSettlementMethod.CASH,
        } as any);
        await balances.save(operatorId, {
            registrationId: registration.id,
            amount: 5_850,
            method: BalanceSettlementMethod.POS,
        } as any);

        const rows = await getPrismaClient().balanceSettlement.findMany({
            where: { registrationId: registration.id },
        });
        const after = await getPrismaClient().registration.findFirstOrThrow({ where: { id: registration.id } });

        expect(rows).toHaveLength(2);
        expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(10_850);
        expect(after.balanceSettledAmount).toBe(10_850);

        const view = await balances.balanceOf(operatorId, registration.id);
        expect(view.openAmount).toBe(0);
    });

    it("RB26 — un incasso al botteghino NON produce alcuna riga di pagamento", async () => {
        const { registration } = await registrationWithBalance(4_000);
        const paymentsBefore = await getPrismaClient().payment.count();

        await balances.save(operatorId, {
            registrationId: registration.id,
            amount: 4_000,
            method: BalanceSettlementMethod.CASH,
        } as any);

        // Il denaro non è mai passato da Mirada: scrivere `Payment` metterebbe
        // una bugia nel registro degli incassi della piattaforma.
        expect(await getPrismaClient().payment.count()).toBe(paymentsBefore);
    });

    it("si rifiuta PRIMA di prendere i soldi: nessun residuo, o importo oltre il dovuto", async () => {
        const { registration: senzaResiduo } = await registrationWithBalance(0);
        await expect(
            balances.save(operatorId, {
                registrationId: senzaResiduo.id,
                amount: 1_000,
                method: BalanceSettlementMethod.CASH,
            } as any),
        ).rejects.toMatchObject({ statusCode: 400 });

        const { registration } = await registrationWithBalance(3_000);
        await expect(
            balances.save(operatorId, {
                registrationId: registration.id,
                amount: 3_001,
                method: BalanceSettlementMethod.CASH,
            } as any),
        ).rejects.toMatchObject({ statusCode: 400 });

        // Nessuna delle due ha lasciato una riga dietro di sé.
        expect(await getPrismaClient().balanceSettlement.count({
            where: { registrationId: { in: [senzaResiduo.id, registration.id] } },
        })).toBe(0);
    });

    it("RF-SAL-10 — il saldo anticipato dal back-office è una riga come le altre, senza postazione", async () => {
        const { registration } = await registrationWithBalance(10_850);

        const settlement = await balances.save(operatorId, {
            registrationId: registration.id,
            amount: 10_850,
            method: BalanceSettlementMethod.BANK_TRANSFER,
        } as any);

        expect(settlement.deviceId).toBeNull();
        expect(settlement.offline).toBe(false);
        expect(settlement.method).toBe(BalanceSettlementMethod.BANK_TRANSFER);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // La coda offline — `RF-SAL-11`
    // ═════════════════════════════════════════════════════════════════════════

    it("la stessa riscossione sincronizzata due volte è UNA riga sola", async () => {
        const { registration } = await registrationWithBalance(6_000);

        const entry = {
            registrationId: registration.id,
            amount: 6_000,
            method: BalanceSettlementMethod.CASH,
            collectedAt: new Date("2026-09-04T21:10:00.000Z"),
            deviceId: "cassa-1",
            deviceReference: "cassa-1/0007",
        };

        const first = await balances.sync(operatorId, { entries: [entry] } as any);
        const second = await balances.sync(operatorId, { entries: [entry] } as any);

        expect(first.accepted).toHaveLength(1);
        expect(first.accepted[0]!.duplicateOfSameEntry).toBe(false);
        expect(second.accepted[0]!.duplicateOfSameEntry).toBe(true);

        const after = await getPrismaClient().registration.findFirstOrThrow({ where: { id: registration.id } });
        expect(after.balanceSettledAmount).toBe(6_000);
        expect(await getPrismaClient().balanceSettlement.count({ where: { registrationId: registration.id } })).toBe(1);
    });

    it("il DOPPIO INCASSO da due postazioni crea la seconda riga e la marca — non la scarta", async () => {
        const { registration } = await registrationWithBalance(10_850);

        await balances.sync(operatorId, {
            entries: [{
                registrationId: registration.id,
                amount: 10_850,
                method: BalanceSettlementMethod.CASH,
                collectedAt: new Date("2026-09-04T21:10:00.000Z"),
                deviceId: "cassa-1",
                deviceReference: "cassa-1/0031",
            }],
        } as any);

        const second = await balances.sync(operatorId, {
            entries: [{
                registrationId: registration.id,
                amount: 10_850,
                method: BalanceSettlementMethod.CASH,
                collectedAt: new Date("2026-09-04T21:12:00.000Z"),
                // Un'ALTRA postazione: non è una risincronizzazione, è un secondo
                // incasso — e quei soldi qualcuno li ha davvero presi in mano.
                deviceId: "cassa-2",
                deviceReference: "cassa-2/0001",
            }],
        } as any);

        expect(second.conflicts).toHaveLength(1);
        expect(second.conflicts[0]!.reason).toBe("ALREADY_SETTLED");
        expect(second.conflicts[0]!.settlement.conflictWithId).not.toBeNull();

        // Due righe, e il contatore le somma entrambe: il registro dice la verità
        // di ciò che è successo, e lo squilibrio resta visibile allo staff invece
        // di essere fatto sparire.
        const rows = await getPrismaClient().balanceSettlement.findMany({
            where: { registrationId: registration.id },
        });
        expect(rows).toHaveLength(2);

        const after = await getPrismaClient().registration.findFirstOrThrow({ where: { id: registration.id } });
        expect(after.balanceSettledAmount).toBe(21_700);
        expect(after.balanceSettledAmount).toBe(rows.reduce((sum, row) => sum + row.amount, 0));
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Alla porta — `RB25` e `RB27`
    // ═════════════════════════════════════════════════════════════════════════

    it("RB25 — un residuo aperto NON blocca l'ingresso: l'esito resta VALID, con l'avviso accanto", async () => {
        const scenario = await createEventScenario();
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });
        await getPrismaClient().registration.update({
            where: { id: registrationId },
            data: { balanceDueAmount: 10_850 },
        });

        const verification = await checkIns.verify(operatorId, {
            code: ticket.code,
            sessionId: scenario.sessionIds[0]!,
        });

        expect(verification.result).toBe("VALID");
        expect(verification.balance).toMatchObject({ open: true, amount: 10_850 });
    });

    it("RB27 — chi non tiene la cassa riceve il flag e NON l'importo", async () => {
        const scenario = await createEventScenario();
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });
        await getPrismaClient().registration.update({
            where: { id: registrationId },
            data: { balanceDueAmount: 10_850 },
        });

        const volunteer = await createUserWithRole(RoleName.CHECKIN_OPERATOR);

        const verification = await checkIns.verify(volunteer, {
            code: ticket.code,
            sessionId: scenario.sessionIds[0]!,
        });

        expect(verification.result).toBe("VALID");
        // Vede CHE c'è un saldo — «manda alla cassa» — e non quanto vale. La
        // cifra non è nascosta dalla schermata: non è proprio nella risposta.
        expect(verification.balance).toMatchObject({ open: true, amount: null });
    });

    it("l'avviso sparisce quando il residuo è saldato, e non resta acceso a zero", async () => {
        const scenario = await createEventScenario();
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });
        await getPrismaClient().registration.update({
            where: { id: registrationId },
            data: { balanceDueAmount: 4_000 },
        });

        await balances.save(operatorId, {
            registrationId,
            amount: 4_000,
            method: BalanceSettlementMethod.CASH,
        } as any);

        const verification = await checkIns.verify(operatorId, {
            code: ticket.code,
            sessionId: scenario.sessionIds[0]!,
        });

        expect(verification.result).toBe("VALID");
        expect(verification.balance).toBeNull();
    });
});

/**
 * Un utente con **un solo ruolo**, per collaudare ciò che quel ruolo NON può.
 *
 * Un test che usasse `god` non collauderebbe nulla di `RB27`: `god` è l'allow-all
 * implicito della piattaforma e vedrebbe la cifra comunque.
 */
async function createUserWithRole(roleName: RoleName): Promise<number> {
    const prisma = getPrismaClient();
    const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

    const contact = await prisma.contact.create({ data: { email: `volontario-${suffix}@example.it` } });
    const person = await prisma.person.create({
        data: { name: "Volontario", surname: "Alla Porta", personType: "USER", contactId: contact.id },
    });
    const user = await prisma.user.create({
        data: {
            username: `volontario-${suffix}`,
            password: "non-usata",
            personId: person.id,
            roles: { create: [{ roleName, isActive: true }] },
        },
    });

    return user.id;
}
