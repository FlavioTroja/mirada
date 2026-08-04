import { configureServiceTest } from "fastify-decorators/testing";
import { CheckInKind, CheckInResult, DanceRole, QuotaScope, TicketStatus } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { CheckInService } from "@services/CheckInService";
import { TicketQrService } from "@services/TicketQrService";
import { createEventScenario, createQuota, readConsumed } from "../fixtures/capacity";
import { createCheckIn, createEntryRequirement, createTicketFor } from "../fixtures/tickets";

/**
 * # Il check-in — §4.13, `09-titoli-e-pass.md` §7
 *
 * I due fatti che questa suite esiste per dimostrare, e che nessuna revisione del
 * codice può garantire da sola:
 *
 * 1. **`RB7`** — un QR vale una sola volta **per sessione**. Il secondo ingresso
 *    sulla stessa coppia è rifiutato; **lo stesso biglietto su una sessione
 *    diversa passa**. Il secondo caso è la prova che *l'utilizzo non è uno stato
 *    del biglietto*: se lo fosse, il Full Pass morirebbe al primo ingresso.
 * 2. **`RF-CHK-6`** — due operatori che registrano lo stesso ingresso offline
 *    producono un **conflitto restituito**, non una riga persa e non una
 *    risoluzione silenziosa.
 *
 * E il terzo, per sottrazione: **`RB19`**, il check-in non consuma capienza. I
 * contatori si rileggono dopo l'ingresso e non si sono mossi.
 */
describe("CheckInService — RB7, RB19 e la sincronizzazione della coda offline", () => {
    let checkIns: CheckInService;
    let qr: TicketQrService;
    let operatorId: number;

    beforeAll(async () => {
        checkIns = await configureServiceTest({ service: CheckInService });
        qr = await configureServiceTest({ service: TicketQrService });
        const god = await getPrismaClient().user.findFirstOrThrow({ where: { username: "god" } });
        operatorId = god.id;
    });

    // ═════════════════════════════════════════════════════════════════════════
    // `RB7` — un QR vale una sola volta per sessione
    // ═════════════════════════════════════════════════════════════════════════

    it("RB7 — il secondo check-in sulla stessa coppia biglietto–sessione è RIFIUTATO", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });

        const first = await checkIns.save(operatorId, {
            ticketId: ticket.id,
            sessionId: scenario.sessionIds[0]!,
            kind: CheckInKind.OPERATOR,
            deviceId: "porta-1",
            offline: false,
            scannedAt: new Date(),
            registrationId,
        } as never);
        expect(first.id).toBeGreaterThan(0);

        await expect(
            checkIns.save(operatorId, {
                ticketId: ticket.id,
                sessionId: scenario.sessionIds[0]!,
                kind: CheckInKind.OPERATOR,
                deviceId: "porta-2",
                offline: false,
                scannedAt: new Date(),
                registrationId,
            } as never),
        ).rejects.toMatchObject({ statusCode: 409 });

        const rows = await getPrismaClient().checkIn.count({
            where: { ticketId: ticket.id, sessionId: scenario.sessionIds[0] },
        });
        expect(rows).toBe(1);
    });

    it("RB7 — LO STESSO BIGLIETTO SU UNA SESSIONE DIVERSA PASSA: l'utilizzo non è uno stato del biglietto", async () => {
        const scenario = await createEventScenario({ sessions: 3 });
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });

        // Tre sessioni, tre ingressi, tutti validi: è il Full Pass scansionato
        // dodici volte in tre giorni.
        for (const sessionId of scenario.sessionIds) {
            const entry = await checkIns.save(operatorId, {
                ticketId: ticket.id,
                sessionId,
                kind: CheckInKind.OPERATOR,
                deviceId: "porta-1",
                offline: false,
                scannedAt: new Date(),
                registrationId,
            } as never);
            expect(entry.sessionId).toBe(sessionId);
        }

        const rows = await getPrismaClient().checkIn.count({ where: { ticketId: ticket.id } });
        expect(rows).toBe(3);

        // E il biglietto è ancora VALID. Non esiste uno stato `USED`.
        const after = await getPrismaClient().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
        expect(after.status).toBe(TicketStatus.VALID);
        expect(after.qrRevokedAt).toBeNull();
    });

    it("RF-CHK-9 — l'annullamento di un ingresso errato riapre la sessione a quel biglietto", async () => {
        const scenario = await createEventScenario();
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });

        const entry = await checkIns.save(operatorId, {
            ticketId: ticket.id,
            sessionId: scenario.sessionIds[0]!,
            kind: CheckInKind.OPERATOR,
            deviceId: "porta-1",
            offline: false,
            scannedAt: new Date(),
            registrationId,
        } as never);

        await checkIns.revoke(operatorId, entry.id);

        // Uscendo dall'indice parziale, il biglietto può rientrare.
        const again = await checkIns.save(operatorId, {
            ticketId: ticket.id,
            sessionId: scenario.sessionIds[0]!,
            kind: CheckInKind.OPERATOR,
            deviceId: "porta-1",
            offline: false,
            scannedAt: new Date(),
            registrationId,
        } as never);
        expect(again.id).not.toBe(entry.id);

        // La riga revocata resta: è un fatto avvenuto e corretto, non cancellato.
        const rows = await getPrismaClient().checkIn.findMany({ where: { ticketId: ticket.id } });
        expect(rows).toHaveLength(2);
        expect(rows.filter(row => row.revokedAt !== null)).toHaveLength(1);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // `RB19` — il check-in non consuma capienza
    // ═════════════════════════════════════════════════════════════════════════

    it("RB19 — l'ingresso NON muove alcun contatore di capienza", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 100,
            consumed: 40,
        });
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });

        const before = await readConsumed(room.id);
        await checkIns.save(operatorId, {
            ticketId: ticket.id,
            sessionId: scenario.sessionIds[0]!,
            kind: CheckInKind.OPERATOR,
            deviceId: "porta-1",
            offline: false,
            scannedAt: new Date(),
            registrationId,
        } as never);

        expect(await readConsumed(room.id)).toBe(before);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // `RF-CHK-6` — la sincronizzazione della coda offline
    // ═════════════════════════════════════════════════════════════════════════

    it("RF-CHK-6 — due operatori offline sullo stesso ingresso producono un CONFLITTO RESTITUITO, mai una riga persa", async () => {
        const scenario = await createEventScenario();
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });

        // Porta 1 sincronizza per prima.
        const firstSync = await checkIns.sync(operatorId, {
            entries: [{
                localId: "coda-porta-1",
                code: ticket.code,
                sessionId: scenario.sessionIds[0]!,
                scannedAt: new Date("2026-09-01T20:00:00.000Z"),
                deviceId: "porta-1",
            }],
        });
        expect(firstSync.accepted).toHaveLength(1);
        expect(firstSync.conflicts).toHaveLength(0);

        // Porta 2 aveva registrato lo stesso ingresso, senza rete e senza saperlo.
        const secondSync = await checkIns.sync(operatorId, {
            entries: [{
                localId: "coda-porta-2",
                code: ticket.code,
                sessionId: scenario.sessionIds[0]!,
                scannedAt: new Date("2026-09-01T20:01:30.000Z"),
                deviceId: "porta-2",
            }],
        });

        expect(secondSync.accepted).toHaveLength(0);
        expect(secondSync.conflicts).toHaveLength(1);

        const conflict = secondSync.conflicts[0]!;
        expect(conflict.localId).toBe("coda-porta-2");
        expect(conflict.reason).toBe("ALREADY_CHECKED_IN");
        // La riga ESISTE: non è stata scartata.
        expect(conflict.checkIn.id).toBeGreaterThan(0);
        expect(conflict.checkIn.conflictWithId).toBe(firstSync.accepted[0]!.checkIn.id);
        // E porta con sé ora e postazione del primo ingresso, che è ciò che serve
        // allo staff per decidere.
        expect(conflict.conflictsWith.deviceId).toBe("porta-1");
        expect(conflict.conflictsWith.scannedAt).toEqual(new Date("2026-09-01T20:00:00.000Z"));

        // Sul database ci sono DUE righe: nulla è stato risolto in silenzio.
        const rows = await getPrismaClient().checkIn.findMany({
            where: { ticketId: ticket.id, sessionId: scenario.sessionIds[0] },
            orderBy: { id: "asc" },
        });
        expect(rows).toHaveLength(2);
        expect(rows[0]!.conflictWithId).toBeNull();
        expect(rows[1]!.conflictWithId).toBe(rows[0]!.id);
        expect(registrationId).toBeGreaterThan(0);
    });

    it("la stessa voce risincronizzata dopo un timeout NON diventa un conflitto con se stessa", async () => {
        const scenario = await createEventScenario();
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });

        const entry = {
            localId: "coda-1",
            code: ticket.code,
            sessionId: scenario.sessionIds[0]!,
            scannedAt: new Date("2026-09-01T21:00:00.000Z"),
            deviceId: "porta-1",
        };

        const first = await checkIns.sync(operatorId, { entries: [entry] });
        const replay = await checkIns.sync(operatorId, { entries: [entry] });

        expect(first.accepted).toHaveLength(1);
        expect(replay.accepted).toHaveLength(1);
        expect(replay.conflicts).toHaveLength(0);
        expect(replay.accepted[0]!.duplicateOfSameScan).toBe(true);
        expect(replay.accepted[0]!.checkIn.id).toBe(first.accepted[0]!.checkIn.id);

        const rows = await getPrismaClient().checkIn.count({ where: { ticketId: ticket.id } });
        expect(rows).toBe(1);
    });

    it("una voce di coda con un biglietto di un altro evento è RIFIUTATA, non messa in conflitto", async () => {
        const mine = await createEventScenario();
        const other = await createEventScenario();
        const { ticket } = await createTicketFor({
            eventId: other.event.id,
            ticketTypeId: other.ticketTypeId,
        });

        const result = await checkIns.sync(operatorId, {
            entries: [{
                localId: "coda-x",
                code: ticket.code,
                sessionId: mine.sessionIds[0]!,
                scannedAt: new Date(),
                deviceId: "porta-1",
            }],
        });

        expect(result.accepted).toHaveLength(0);
        expect(result.conflicts).toHaveLength(0);
        expect(result.rejected).toHaveLength(1);
        expect(result.rejected[0]!.reason).toBe(CheckInResult.WRONG_EVENT);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // I cinque esiti (`RF-CHK-4`)
    // ═════════════════════════════════════════════════════════════════════════

    it("verify — ALREADY_USED restituisce ORA E POSTAZIONE del primo ingresso", async () => {
        const scenario = await createEventScenario();
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });

        const scannedAt = new Date("2026-09-02T21:15:00.000Z");
        await createCheckIn({
            ticketId: ticket.id,
            sessionId: scenario.sessionIds[0]!,
            registrationId,
            operatorUserId: operatorId,
            deviceId: "ingresso-laterale",
            scannedAt,
        });

        const verification = await checkIns.verify({ code: ticket.code, sessionId: scenario.sessionIds[0]! });

        expect(verification.result).toBe(CheckInResult.ALREADY_USED);
        expect(verification.firstEntry).toMatchObject({
            deviceId: "ingresso-laterale",
            scannedAt,
        });
    });

    it("verify — REQUIREMENT_BLOCKED NOMINA il requisito mancante, e non ne rivela il contenuto", async () => {
        const scenario = await createEventScenario();
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });
        await createEntryRequirement({ eventId: scenario.event.id, label: "Liberatoria fotografica" });

        const verification = await checkIns.verify({ code: ticket.code, sessionId: scenario.sessionIds[0]! });

        expect(verification.result).toBe(CheckInResult.REQUIREMENT_BLOCKED);
        expect(verification.blockingRequirement).toBeTruthy();
        expect((verification.blockingRequirement!.label as { it: string }).it).toBe("Liberatoria fotografica");

        // `RB12` — il nome sì, il contenuto mai.
        const serialized = JSON.stringify(verification);
        expect(serialized).not.toContain("CONTENUTO RISERVATO");
    });

    it("verify — WRONG_EVENT quando la sessione non è compresa nel titolo", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        const prisma = getPrismaClient();

        // Un titolo che include solo la prima sessione.
        const restricted = await prisma.ticketType.create({
            data: {
                eventId: scenario.event.id,
                name: { it: "Solo sabato" },
                basePrice: 3_000,
                sessions: { create: [{ sessionId: scenario.sessionIds[0]! }] },
            },
        });
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: restricted.id,
        });

        const verification = await checkIns.verify({ code: ticket.code, sessionId: scenario.sessionIds[1]! });
        expect(verification.result).toBe(CheckInResult.WRONG_EVENT);
    });

    it("verify — REFUNDED_OR_CANCELLED su un biglietto annullato", async () => {
        const scenario = await createEventScenario();
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            status: TicketStatus.CANCELLED,
        });

        const verification = await checkIns.verify({ code: ticket.code, sessionId: scenario.sessionIds[0]! });
        expect(verification.result).toBe(CheckInResult.REFUNDED_OR_CANCELLED);
    });

    it("verify — un QR firmato è accettato, uno manomesso no, e la firma è verificata anche lato server", async () => {
        const scenario = await createEventScenario();
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            role: DanceRole.LEADER,
        });

        const token = qr.issueToken(ticket);
        const ok = await checkIns.verify({ code: token, sessionId: scenario.sessionIds[0]! });
        expect(ok.result).toBe(CheckInResult.VALID);
        expect(ok.signature?.verified).toBe(true);

        const [header, payload, sig] = token.split(".");
        const forged = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
        forged.code = "CODICE-INVENTATO";
        const tampered = `${header}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`;

        const refused = await checkIns.verify({ code: tampered, sessionId: scenario.sessionIds[0]! });
        expect(refused.result).not.toBe(CheckInResult.VALID);
        expect(refused.signature?.verified).toBe(false);
    });

    it("il codice invalidato da un trasferimento non risolve più alcun biglietto", async () => {
        const scenario = await createEventScenario();
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });
        const oldCode = ticket.code;

        await getPrismaClient().ticket.update({
            where: { id: ticket.id },
            data: { code: `${oldCode}-NUOVO` },
        });

        const verification = await checkIns.verify({ code: oldCode, sessionId: scenario.sessionIds[0]! });
        expect(verification.result).toBe(CheckInResult.WRONG_EVENT);
        expect(verification.ticketId).toBeNull();
    });
});
