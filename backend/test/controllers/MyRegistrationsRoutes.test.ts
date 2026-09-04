import { DanceRole, TicketStatus } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { login } from "../helpers";
import { createEventScenario } from "../fixtures/capacity";
import { createDancer, createTicketFor } from "../fixtures/tickets";

const app = (globalThis as any).__TEST_APP__;

/**
 * **Le proprie iscrizioni sul sito pubblico** — `GET /registrations/mine` e
 * `GET /tickets/:id/qr`.
 *
 * Sono le due rotte con cui una persona vede i propri biglietti, e portano
 * addosso due garanzie che non si vedono guardando la pagina:
 *
 *  1. **si vede solo la propria roba**, e nessuna combinazione di ruoli o di
 *     appartenenze deve poter allargare quell'insieme;
 *  2. **il contenuto firmato del QR non esce come testo**, mai: è la chiave
 *     d'ingresso, e la si serve disegnata.
 */
describe("Le proprie iscrizioni (sito pubblico)", () => {
    /** Il ballerino accede con la password del fixture. */
    const PASSWORD = "secret";

    it("restituisce le proprie iscrizioni con evento e biglietti, e nient'altro", async () => {
        const scenario = await createEventScenario();
        const dancer = await createDancer({});
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            role: DanceRole.FOLLOWER,
            personId: dancer.user.personId,
            holderName: "Nadia",
            holderSurname: "Verdi",
        });

        const session = await login(app, dancer.user.username, PASSWORD);
        const res = await app.inject({
            method: "GET",
            url: "/api/registrations/mine",
            headers: { authorization: session },
        });

        expect(res.statusCode).toBe(200);
        const body = res.json();

        // L'evento del fixture comincia domani: è un evento a cui si sta
        // andando, non uno a cui si è stati.
        expect(body.upcoming).toHaveLength(1);
        expect(body.past).toHaveLength(0);

        const row = body.upcoming[0];
        expect(row.event.id).toBe(scenario.event.id);
        expect(row.event.slug).toBe(scenario.event.slug);
        // La scheda dell'evento serve a riconoscerlo: senza il nome della sala
        // e la città, due edizioni dello stesso festival sono indistinguibili.
        expect(row.event.venueName).toBeTruthy();
        expect(row.event.city).toBe("Roma");
        expect(row.tickets).toHaveLength(1);
        expect(row.tickets[0].id).toBe(ticket.id);
        expect(row.tickets[0].qrAvailable).toBe(true);

        // **Il codice non esce di qui.** È il contenuto del QR, cioè ciò con cui
        // si entra: la sua unica via d'uscita è l'immagine.
        expect(JSON.stringify(body)).not.toContain(ticket.code);
    });

    it("NON mostra le iscrizioni di un'altra persona", async () => {
        const scenario = await createEventScenario();
        const owner = await createDancer({});
        const stranger = await createDancer({});
        await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            role: DanceRole.LEADER,
            personId: owner.user.personId,
        });

        const session = await login(app, stranger.user.username, PASSWORD);
        const res = await app.inject({
            method: "GET",
            url: "/api/registrations/mine",
            headers: { authorization: session },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ upcoming: [], past: [] });
    });

    it("è NEGATO senza sessione: sono dati personali, non una vetrina", async () => {
        const res = await app.inject({ method: "GET", url: "/api/registrations/mine" });
        expect(res.statusCode).toBe(401);
    });

    it("tace le iscrizioni cancellate: un carrello abbandonato non è un evento a cui vai", async () => {
        const scenario = await createEventScenario();
        const dancer = await createDancer({});
        const { registrationId } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            personId: dancer.user.personId,
        });
        await getPrismaClient().registration.update({
            where: { id: registrationId },
            data: { deleted: true },
        });

        const session = await login(app, dancer.user.username, PASSWORD);
        const res = await app.inject({
            method: "GET",
            url: "/api/registrations/mine",
            headers: { authorization: session },
        });

        expect(res.json().upcoming).toHaveLength(0);
        expect(res.json().past).toHaveLength(0);
    });

    it("divide prossimi e passati sulla FINE dell'evento, non sull'inizio", async () => {
        const scenario = await createEventScenario();
        const dancer = await createDancer({});
        await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            personId: dancer.user.personId,
        });

        // Cominciato ieri, finisce domani: un festival in corso è ancora un
        // evento a cui stai andando. Tagliare sull'inizio lo dichiarerebbe
        // «passato» mentre ci sei dentro.
        await getPrismaClient().event.update({
            where: { id: scenario.event.id },
            data: {
                startAt: new Date(Date.now() - 86_400_000),
                endAt: new Date(Date.now() + 86_400_000),
            },
        });

        const session = await login(app, dancer.user.username, PASSWORD);
        const inProgress = await app.inject({
            method: "GET",
            url: "/api/registrations/mine",
            headers: { authorization: session },
        });
        expect(inProgress.json().upcoming).toHaveLength(1);
        expect(inProgress.json().past).toHaveLength(0);

        await getPrismaClient().event.update({
            where: { id: scenario.event.id },
            data: {
                startAt: new Date(Date.now() - 172_800_000),
                endAt: new Date(Date.now() - 86_400_000),
            },
        });

        const finished = await app.inject({
            method: "GET",
            url: "/api/registrations/mine",
            headers: { authorization: session },
        });
        expect(finished.json().upcoming).toHaveLength(0);
        expect(finished.json().past).toHaveLength(1);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Il QR come immagine
    // ═════════════════════════════════════════════════════════════════════════

    it("serve il QR del PROPRIO biglietto come PNG", async () => {
        const scenario = await createEventScenario();
        const dancer = await createDancer({});
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            personId: dancer.user.personId,
        });

        const session = await login(app, dancer.user.username, PASSWORD);
        const res = await app.inject({
            method: "GET",
            url: `/api/tickets/${ticket.id}/qr`,
            headers: { authorization: session },
        });

        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toContain("image/png");
        // La firma PNG: è davvero un'immagine, non un JSON travestito.
        expect(res.rawPayload.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        // Non deve restare in nessuna cache condivisa: è la chiave d'ingresso
        // di una persona.
        expect(String(res.headers["cache-control"])).toContain("no-store");
    });

    it("NEGA il QR del biglietto di un altro", async () => {
        const scenario = await createEventScenario();
        const owner = await createDancer({});
        const stranger = await createDancer({});
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            personId: owner.user.personId,
        });

        const session = await login(app, stranger.user.username, PASSWORD);
        const res = await app.inject({
            method: "GET",
            url: `/api/tickets/${ticket.id}/qr`,
            headers: { authorization: session },
        });

        // **404 e non 403**: al §1.5 un biglietto altrui non è vietato, non
        // esiste. Un 403 confermerebbe che a quell'id c'è qualcosa.
        expect(res.statusCode).toBe(404);
    });

    it("NON disegna il QR di un biglietto revocato", async () => {
        const scenario = await createEventScenario();
        const dancer = await createDancer({});
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            personId: dancer.user.personId,
            status: TicketStatus.REFUNDED,
        });
        await getPrismaClient().ticket.update({
            where: { id: ticket.id },
            data: { qrRevokedAt: new Date() },
        });

        const session = await login(app, dancer.user.username, PASSWORD);
        const res = await app.inject({
            method: "GET",
            url: `/api/tickets/${ticket.id}/qr`,
            headers: { authorization: session },
        });

        // Mostrarlo manderebbe qualcuno alla porta convinto di avere un
        // biglietto valido: meglio dirlo qui.
        expect(res.statusCode).toBe(404);
    });

    it("l'elenco dichiara il QR non disponibile quando è stato revocato", async () => {
        const scenario = await createEventScenario();
        const dancer = await createDancer({});
        const { ticket } = await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            personId: dancer.user.personId,
        });
        await getPrismaClient().ticket.update({
            where: { id: ticket.id },
            data: { qrRevokedAt: new Date(), status: TicketStatus.CANCELLED },
        });

        const session = await login(app, dancer.user.username, PASSWORD);
        const res = await app.inject({
            method: "GET",
            url: "/api/registrations/mine",
            headers: { authorization: session },
        });

        // Il biglietto **resta in elenco**: sapere che non vale più è
        // un'informazione, farlo sparire è una sorpresa alla porta.
        const row = res.json().upcoming[0];
        expect(row.tickets).toHaveLength(1);
        expect(row.tickets[0].qrAvailable).toBe(false);
        expect(row.tickets[0].status).toBe(TicketStatus.CANCELLED);
    });
});
