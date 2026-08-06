import { DanceRole, PassIssuanceReason, QuotaScope, RegistrationStatus } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { importPublicKeyFromBase64, verifyCompactJws } from "@utils/helpers/jws";
import { login } from "../helpers";
import { createEventScenario, createQuota, createRoleQuotas, readConsumed } from "../fixtures/capacity";
import { createDancer, createEntryRequirement, createTicketFor } from "../fixtures/tickets";

const app = (globalThis as any).__TEST_APP__;

/**
 * Le rotte della fase D1 **sul filo HTTP**: il manifest firmato, la verifica
 * minimizzata, il trasferimento che muove capienza e la sincronizzazione.
 *
 * Sono i percorsi che l'operatore e l'organizzatore toccano davvero, e ciascuno
 * di essi porta un invariante che non è verificabile a livello di servizio: la
 * forma del contratto, il permesso richiesto, e — soprattutto — **che cosa NON
 * esce dall'API**.
 */
describe("Rotte di biglietti e check-in (fase D1)", () => {
    let god: string;

    beforeAll(async () => {
        god = await login(app, "god", "god");
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Il manifest firmato (`RF-CHK-2`, `RF-CHK-3`)
    // ═════════════════════════════════════════════════════════════════════════

    it("GET /events/:id/checkin-manifest — lista firmata, chiave pubblica, sessioni e requisiti bloccanti", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            role: DanceRole.LEADER,
            holderName: "Anna",
            holderSurname: "Rossi",
            holderEmail: "anna.rossi@test.it",
        });
        await createEntryRequirement({ eventId: scenario.event.id, label: "Liberatoria fotografica" });

        const res = await app.inject({
            method: "GET",
            url: `/api/events/${scenario.event.id}/checkin-manifest`,
            headers: { authorization: god },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();

        expect(body.manifest.eventId).toBe(scenario.event.id);
        expect(body.manifest.sessions).toHaveLength(2);
        expect(body.manifest.blockingRequirements).toHaveLength(1);
        expect(body.manifest.entries).toHaveLength(1);

        const entry = body.manifest.entries[0];
        expect(entry.ticketId).toBe(ticket.id);
        expect(entry.code).toBe(ticket.code);
        expect(entry.role).toBe(DanceRole.LEADER);
        expect(entry.registrationId).toBe(registrationId);
        expect(entry.sessionIds).toHaveLength(2);
        expect(entry.blockingRequirements).toHaveLength(1);

        // ── `RB12` — ciò che NON deve uscire ──────────────────────────────────
        const serialized = JSON.stringify(body);
        expect(serialized).not.toContain("anna.rossi@test.it");
        expect(serialized).not.toContain("CONTENUTO RISERVATO");

        // ── `RF-CHK-3` — la chiave pubblica viaggia con la lista ─────────────
        expect(body.publicKey.algorithm).toBe("Ed25519");
        expect(body.publicKey.spki).toEqual(expect.any(String));
        expect(body.publicKey.jwk.crv).toBe("Ed25519");

        // E la firma del manifest si verifica con quella sola chiave, offline.
        const publicKey = importPublicKeyFromBase64(body.publicKey.spki);
        const verified = verifyCompactJws<{ manifestOf: number; entryCount: number }>(
            body.signature.value,
            keyId => (keyId === body.publicKey.keyId ? publicKey : null),
        );
        expect(verified.payload.manifestOf).toBe(scenario.event.id);
        expect(verified.payload.entryCount).toBe(1);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // La verifica alla porta (`RF-CHK-4`, `RB12`)
    // ═════════════════════════════════════════════════════════════════════════

    it("POST /tickets/verify — la risposta NON contiene email, contenuto dei requisiti né diete", async () => {
        const scenario = await createEventScenario();
        const prisma = getPrismaClient();

        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            role: DanceRole.FOLLOWER,
            holderName: "Marco",
            holderSurname: "Bianchi",
            holderEmail: "marco.bianchi@test.it",
        });

        // Un requisito soddisfatto, con un contenuto che non deve uscire.
        await createEntryRequirement({
            eventId: scenario.event.id,
            registrationId,
            outcomeStatus: "VALID",
        });

        // Un servizio accessorio con una dieta dichiarata negli attributi.
        const serviceQuota = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.SERVICE,
            scopeId: scenario.serviceId,
            limit: 50,
        });
        await prisma.eventService.update({
            where: { id: scenario.serviceId },
            data: { attributesConfig: { dieta: ["INTOLLERANZA AL GLUTINE — DATO SANITARIO"] } },
        });
        await prisma.quotaConsumption.create({
            data: { capacityQuotaId: serviceQuota.id, registrationId, quantity: 1 },
        });

        const res = await app.inject({
            method: "POST",
            url: "/api/tickets/verify",
            headers: { authorization: god },
            payload: { code: ticket.code, sessionId: scenario.sessionIds[0] },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();

        // Ciò che DEVE esserci: nominativo, ruolo di ballo, titolo, sessioni
        // incluse, servizi acquistati (§4.13).
        expect(body.result).toBe("VALID");
        expect(body.holder).toMatchObject({ name: "Marco", surname: "Bianchi", role: DanceRole.FOLLOWER });
        expect(body.ticketType).toBeTruthy();
        expect(body.sessions).toHaveLength(1);
        expect(body.sessions[0].requested).toBe(true);
        expect(body.services).toHaveLength(1);
        expect(body.services[0].id).toBe(scenario.serviceId);

        // Ciò che NON deve esserci (`RB12`).
        const serialized = JSON.stringify(body);
        expect(serialized).not.toContain("marco.bianchi@test.it");
        expect(serialized).not.toContain("CONTENUTO RISERVATO");
        expect(serialized).not.toContain("DATO SANITARIO");
        expect(serialized).not.toContain("INTOLLERANZA");
    });

    it("POST /check-ins/create — doppio ingresso sulla STESSA sessione rifiutato, sessione DIVERSA accettata", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });

        const first = await app.inject({
            method: "POST",
            url: "/api/check-ins/create",
            headers: { authorization: god },
            payload: {
                ticketId: ticket.id,
                sessionId: scenario.sessionIds[0],
                deviceId: "porta-1",
            },
        });
        expect(first.statusCode).toBe(200);

        const second = await app.inject({
            method: "POST",
            url: "/api/check-ins/create",
            headers: { authorization: god },
            payload: {
                ticketId: ticket.id,
                sessionId: scenario.sessionIds[0],
                deviceId: "porta-1",
            },
        });
        expect(second.statusCode).toBe(409);

        // Lo stesso biglietto su un'altra sessione entra: l'utilizzo non è uno
        // stato del biglietto.
        const otherSession = await app.inject({
            method: "POST",
            url: "/api/check-ins/create",
            headers: { authorization: god },
            payload: {
                ticketId: ticket.id,
                sessionId: scenario.sessionIds[1],
                deviceId: "porta-1",
            },
        });
        expect(otherSession.statusCode).toBe(200);

        const after = await getPrismaClient().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
        expect(after.status).toBe("VALID");
    });

    it("POST /check-ins/sync — il doppio ingresso torna come CONFLITTO, non come riga persa", async () => {
        const scenario = await createEventScenario();
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });

        const payload = (deviceId: string, localId: string, minute: number) => ({
            entries: [{
                localId,
                code: ticket.code,
                sessionId: scenario.sessionIds[0],
                scannedAt: new Date(`2026-10-01T22:${String(minute).padStart(2, "0")}:00.000Z`).toISOString(),
                deviceId,
            }],
        });

        const first = await app.inject({
            method: "POST",
            url: "/api/check-ins/sync",
            headers: { authorization: god },
            payload: payload("porta-1", "coda-1", 10),
        });
        expect(first.statusCode).toBe(200);
        expect(first.json().accepted).toHaveLength(1);
        expect(first.json().conflicts).toHaveLength(0);

        const second = await app.inject({
            method: "POST",
            url: "/api/check-ins/sync",
            headers: { authorization: god },
            payload: payload("porta-2", "coda-2", 12),
        });
        expect(second.statusCode).toBe(200);

        const body = second.json();
        expect(body.accepted).toHaveLength(0);
        expect(body.conflicts).toHaveLength(1);
        expect(body.conflicts[0].localId).toBe("coda-2");
        expect(body.conflicts[0].checkIn.conflictWithId).toBe(first.json().accepted[0].checkIn.id);
        expect(body.conflicts[0].conflictsWith.deviceId).toBe("porta-1");

        // La coda dei conflitti di `/check-in/conflicts` è interrogabile.
        const conflicts = await app.inject({
            method: "POST",
            url: "/api/check-ins/",
            headers: { authorization: god },
            payload: {
                query: { eventId: scenario.event.id, conflictsOnly: true },
                options: { page: 1, limit: 10, populate: "" },
            },
        });
        expect(conflicts.statusCode).toBe(200);
        expect(conflicts.json().totalDocs).toBe(1);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Il trasferimento (`RB8`, `RF-TCK-7`)
    // ═════════════════════════════════════════════════════════════════════════

    it("POST /tickets/:id/transfer — ruolo DIVERSO su quota SATURA: rifiutato, e NULLA è cambiato", async () => {
        const scenario = await createEventScenario();
        const prisma = getPrismaClient();

        // Leader ha spazio, follower è pieno: il trasferimento a un follower deve
        // fallire, e fallire senza lasciare tracce.
        const { leader, follower } = await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 10,
            followerLimit: 5,
            leaderConsumed: 0,
            followerConsumed: 5,
        });

        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            role: DanceRole.LEADER,
        });
        // L'iscrizione occupa davvero il posto leader: è lo stato da cui si parte.
        await prisma.capacityQuota.update({ where: { id: leader.id }, data: { consumed: 1 } });
        await prisma.quotaConsumption.create({
            data: { capacityQuotaId: leader.id, registrationId, quantity: 1 },
        });

        const recipient = await createDancer({ preferredRole: "FOLLOWER" });

        const before = {
            leader: await readConsumed(leader.id),
            follower: await readConsumed(follower.id),
            consumptions: await prisma.quotaConsumption.findMany({
                where: { registrationId },
                orderBy: { id: "asc" },
            }),
            ticket: await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
            registration: await prisma.registration.findUniqueOrThrow({ where: { id: registrationId } }),
        };

        const res = await app.inject({
            method: "POST",
            url: `/api/tickets/${ticket.id}/transfer`,
            headers: { authorization: god },
            payload: { emailOrNickname: recipient.profile.nickname },
        });

        expect(res.statusCode).toBe(409);
        expect(res.json().code).toBe("SOLD_OUT");

        // ── E ora la parte che conta: NULLA è cambiato ────────────────────────
        expect(await readConsumed(leader.id)).toBe(before.leader);
        expect(await readConsumed(follower.id)).toBe(before.follower);

        const consumptionsAfter = await prisma.quotaConsumption.findMany({
            where: { registrationId },
            orderBy: { id: "asc" },
        });
        expect(consumptionsAfter.map(c => ({ q: c.capacityQuotaId, n: c.quantity })))
            .toEqual(before.consumptions.map(c => ({ q: c.capacityQuotaId, n: c.quantity })));

        const ticketAfter = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
        expect(ticketAfter.code).toBe(before.ticket.code);
        expect(ticketAfter.holderSurname).toBe(before.ticket.holderSurname);

        const registrationAfter = await prisma.registration.findUniqueOrThrow({ where: { id: registrationId } });
        expect(registrationAfter.personUserId).toBe(before.registration.personUserId);
        expect(registrationAfter.assignedRole).toBe(DanceRole.LEADER);

        // Nessuna riga di storico: il passaggio non è avvenuto.
        const transfers = await prisma.ticketTransfer.count({ where: { ticketId: ticket.id } });
        expect(transfers).toBe(0);
    });

    it("POST /tickets/:id/transfer — a parità di ruolo il QR cambia, i contatori no, i requisiti si rivalutano", async () => {
        const scenario = await createEventScenario();
        const prisma = getPrismaClient();

        const { leader } = await createRoleQuotas({
            eventId: scenario.event.id,
            leaderLimit: 10,
            followerLimit: 10,
        });

        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            role: DanceRole.LEADER,
        });
        await prisma.capacityQuota.update({ where: { id: leader.id }, data: { consumed: 1 } });
        await prisma.quotaConsumption.create({
            data: { capacityQuotaId: leader.id, registrationId, quantity: 1 },
        });

        // Un requisito già accettato dal PRIMO titolare: dopo il passaggio non
        // può più valere (`RB8`).
        const requirement = await createEntryRequirement({
            eventId: scenario.event.id,
            registrationId,
            outcomeStatus: "VALID",
        });

        const recipient = await createDancer({ preferredRole: "LEADER" });
        const consumedBefore = await readConsumed(leader.id);

        const res = await app.inject({
            method: "POST",
            url: `/api/tickets/${ticket.id}/transfer`,
            headers: { authorization: god },
            payload: { emailOrNickname: recipient.email },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();

        // Il QR precedente è invalidato, il nuovo emesso.
        expect(body.ticket.code).not.toBe(ticket.code);
        expect(body.transfer.previousCode).toBe(ticket.code);
        expect(body.roleMoved).toBe(false);

        // Stesso ruolo: nessun movimento di capienza (`05` §8).
        expect(await readConsumed(leader.id)).toBe(consumedBefore);

        // L'iscrizione si è spostata sul nuovo titolare.
        const registrationAfter = await prisma.registration.findUniqueOrThrow({ where: { id: registrationId } });
        expect(registrationAfter.personUserId).toBe(recipient.user.id);

        // E i requisiti sono tornati da provare: una liberatoria firmata da un
        // altro non vale.
        const outcome = await prisma.requirementOutcome.findFirstOrThrow({
            where: { registrationId, eventRequirementId: requirement.id },
        });
        expect(outcome.status).toBe("TO_PROVIDE");
        expect(outcome.acceptedAt).toBeNull();
        expect(outcome.acceptedIp).toBeNull();
        expect(body.requirementsRevaluated).toBe(1);

        // Il vecchio codice non apre più nulla.
        const verify = await app.inject({
            method: "POST",
            url: "/api/tickets/verify",
            headers: { authorization: god },
            payload: { code: ticket.code, sessionId: scenario.sessionIds[0] },
        });
        expect(verify.json().result).not.toBe("VALID");
    });

    it("POST /tickets/:id/transfer — un pass AL PORTATORE non è trasferibile", async () => {
        const scenario = await createEventScenario();
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            bearer: true,
        });
        const recipient = await createDancer({});

        const res = await app.inject({
            method: "POST",
            url: `/api/tickets/${ticket.id}/transfer`,
            headers: { authorization: god },
            payload: { emailOrNickname: recipient.email },
        });
        expect(res.statusCode).toBe(400);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Emissione manuale e conferma d'ordine
    // ═════════════════════════════════════════════════════════════════════════

    it("POST /events/:id/pass-issuances/bulk — oltre la capienza: 200 con avviso, mai un rifiuto", async () => {
        const scenario = await createEventScenario();
        const room = await createQuota({
            eventId: scenario.event.id,
            scope: QuotaScope.EVENT,
            limit: 2,
            consumed: 2,
        });

        const res = await app.inject({
            method: "POST",
            url: `/api/events/${scenario.event.id}/pass-issuances/bulk`,
            headers: { authorization: god },
            payload: {
                ticketTypeId: scenario.ticketTypeId,
                quantity: 3,
                reason: PassIssuanceReason.COMPLIMENTARY,
                nominal: false,
                note: "Ospiti dell'organizzatore",
            },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.tickets).toHaveLength(3);
        expect(body.warnings.length).toBeGreaterThan(0);
        expect(body.warnings.find((w: { quotaId: number }) => w.quotaId === room.id).exceededBy).toBe(3);
        expect(await readConsumed(room.id)).toBe(5);

        // Le iscrizioni create sono confermate: un accredito non attende conferma.
        const registrations = await getPrismaClient().registration.findMany({
            where: { id: { in: body.registrationIds } },
        });
        expect(registrations.every(r => r.status === RegistrationStatus.CONFIRMED)).toBe(true);
    });

    it("GET /tickets/:id/pdf — conferma d'ordine con QR, dichiarata NON fiscale (RF-TCK-11)", async () => {
        const scenario = await createEventScenario();
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
        });

        const res = await app.inject({
            method: "GET",
            url: `/api/tickets/${ticket.id}/pdf`,
            headers: { authorization: god },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.fileUrl).toContain(".pdf");
        expect(body.documentKind).toBe("ORDER_CONFIRMATION");
        expect(body.fiscalDocument).toBe(false);

        // Nessuna numerazione progressiva: il nome del file porta il codice
        // casuale del biglietto, non un contatore.
        expect(body.fileUrl).toContain(ticket.code);

        const stored = await getPrismaClient().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
        expect(stored.pdfFileId).toBe(body.fileId);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Il cruscotto e l'esportazione, ora che le entità esistono (`RB21`)
    // ═════════════════════════════════════════════════════════════════════════

    it("GET /events/:id/dashboard — presenze e requisiti mancanti NON sono più dichiarati indisponibili", async () => {
        const scenario = await createEventScenario({ sessions: 2 });
        const { ticket, registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            role: DanceRole.LEADER,
        });

        // L'ingresso PRIMA del requisito: un requisito bloccante in ingresso senza
        // esito fermerebbe la scansione (`RF-CHK-4`), ed è ciò che l'altro test
        // verifica. Qui interessa che il cruscotto conti la presenza avvenuta e
        // segnali comunque il requisito ancora da provare.
        const entry = await app.inject({
            method: "POST",
            url: "/api/check-ins/create",
            headers: { authorization: god },
            payload: { ticketId: ticket.id, sessionId: scenario.sessionIds[0], deviceId: "porta-1" },
        });
        expect(entry.statusCode).toBe(200);

        await createEntryRequirement({ eventId: scenario.event.id, label: "Liberatoria" });

        const res = await app.inject({
            method: "GET",
            url: `/api/events/${scenario.event.id}/dashboard`,
            headers: { authorization: god },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        // `RB21` — il perimetro dichiarato non può più elencare come mancanti le
        // entità che questa fase ha costruito.
        expect(body.perimeter.missingEntities).not.toContain("Ticket");
        expect(body.perimeter.missingEntities).not.toContain("CheckIn");
        expect(body.perimeter.missingEntities).not.toContain("RequirementOutcome");
        // Il percorso d'acquisto è costruito: dichiararlo mancante era una
        // bugia del cruscotto su sé stesso.
        expect(body.perimeter.missingEntities).not.toContain("Order");
        expect(body.perimeter.missingEntities).not.toContain("Payment");
        // `Refund` invece manca davvero, ed è l'unica che deve restare elencata.
        expect(body.perimeter.missingEntities).toEqual(["Refund"]);

        expect(body.sections.attendance.available).toBe(true);
        expect(body.sections.attendance.totalEntries).toBe(1);
        expect(body.sections.attendance.distinctTickets).toBe(1);
        expect(body.sections.attendance.openConflicts).toBe(0);
        expect(body.sections.attendance.bySession).toHaveLength(2);

        expect(body.sections.missingRequirements.available).toBe(true);
        expect(body.sections.missingRequirements.registrationsWithMissing).toBe(1);
        expect(body.sections.missingRequirements.byRequirement[0].missing).toBe(1);
        expect(registrationId).toBeGreaterThan(0);

        // Venduto e incassato sono ora calcolabili. In questo scenario il
        // biglietto nasce da `PassIssuance` e non da un ordine: le sezioni sono
        // quindi **disponibili e a zero**, che è un'affermazione diversa da
        // «non calcolabili» — ed è esattamente la distinzione di `RB21` fra un
        // dato assente e un dato pari a zero.
        expect(body.sections.soldByTicketType.available).toBe(true);
        expect(body.sections.soldByTicketType.items.every((i: { sold: number }) => i.sold === 0)).toBe(true);
        expect(body.sections.soldByTicketType.servicesGross).toBe(0);

        expect(body.sections.netRevenue.available).toBe(true);
        expect(body.sections.netRevenue.paidOrders).toBe(0);
        expect(body.sections.netRevenue.total).toBe(0);
        expect(body.sections.netRevenue.cashed).toBe(0);

        // L'impegnato esiste comunque: il posto è occupato anche senza un ordine.
        expect(body.sections.committedByTicketType.available).toBe(true);
    });

    it("POST /events/:id/exports — ATTENDANCE è producibile e non contiene contatti (RB12)", async () => {
        const scenario = await createEventScenario();
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            role: DanceRole.FOLLOWER,
            holderEmail: "riservata@test.it",
        });
        await app.inject({
            method: "POST",
            url: "/api/check-ins/create",
            headers: { authorization: god },
            payload: { ticketId: ticket.id, sessionId: scenario.sessionIds[0], deviceId: "porta-3" },
        });

        const res = await app.inject({
            method: "POST",
            url: `/api/events/${scenario.event.id}/exports`,
            headers: { authorization: god },
            payload: { kind: "ATTENDANCE", columns: [] },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.rows).toBe(1);
        expect(body.basedOn).toContain("CheckIn");
        expect(body.columns).toContain("deviceId");
        // L'elenco delle colonne è chiuso e non contiene contatti.
        expect(body.columns).not.toContain("holderEmail");

        // Una colonna non ammessa è 400 con l'elenco delle valide.
        const refused = await app.inject({
            method: "POST",
            url: `/api/events/${scenario.event.id}/exports`,
            headers: { authorization: god },
            payload: { kind: "ATTENDANCE", columns: ["holderEmail"] },
        });
        expect(refused.statusCode).toBe(400);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Permessi
    // ═════════════════════════════════════════════════════════════════════════

    it("il DANCER non può scaricare il manifest di check-in di un evento", async () => {
        const scenario = await createEventScenario();
        const dancer = await login(app, "user", "user");

        const res = await app.inject({
            method: "GET",
            url: `/api/events/${scenario.event.id}/checkin-manifest`,
            headers: { authorization: dancer },
        });

        // `READ#CHECK_IN#ALL` non è concesso al DANCER, che pure ha
        // `READ#EVENT#ALL`: senza questa scelta l'elenco degli iscritti di
        // qualunque evento pubblicato sarebbe scaricabile da chiunque.
        expect(res.statusCode).toBe(403);
    });
});
