import { DanceRole } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { login, markEmailConfirmed } from "../helpers";
import { createEventScenario } from "../fixtures/capacity";
import { createTicketFor } from "../fixtures/tickets";

const app = (globalThis as any).__TEST_APP__;

let sequence = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${++sequence}`;

/**
 * **L'anagrafica unica del ballerino** — `16-anagrafica-unica.md`.
 *
 * `User`, `Person` e `Contact` non hanno `organizationId`: l'anagrafica è di
 * piattaforma, e l'isolamento fra organizzazioni vive sull'ISCRIZIONE, che
 * discende dall'evento. Da qui discende che una persona può essere **censita
 * senza account** — una scuola la iscrive a un corso digitandone l'indirizzo — e
 * che quell'anagrafica dev'essere **rivendicabile** il giorno in cui la persona
 * si registra.
 *
 * Questa suite prova le due facce della stessa cosa:
 *
 *  1. che la rivendicazione **avvenga**, perché senza di essa la registrazione
 *     si romperebbe sul vincolo unico di `Contact.email` — e si romperebbe sul
 *     percorso d'ingresso, cioè la prima cosa che una persona fa;
 *  2. che rivendicare **restituisca il passato**: le iscrizioni fatte a mano
 *     prima dell'account compaiono da sole, perché puntavano già alla persona.
 */
describe("L'anagrafica unica del ballerino", () => {
    const PASSWORD = "Password2027!";
    const prisma = () => getPrismaClient();

    /** Ciò che fa una scuola quando iscrive un allievo che non ha un account. */
    async function censisci(email: string, name = "Maria", surname = "Rossi") {
        const contact = await prisma().contact.create({ data: { email } });
        return prisma().person.create({
            data: { name, surname, personType: "USER", contactId: contact.id },
        });
    }

    function registra(username: string, email: string) {
        return app.inject({
            method: "POST",
            url: "/api/users/register",
            payload: {
                username,
                password: PASSWORD,
                firstName: "Maria",
                lastName: "Rossi",
                email,
            },
        });
    }

    it("chi è censito senza account si registra e AGGANCIA la propria anagrafica", async () => {
        const tag = unique("claim");
        const email = `${tag}@test.it`;
        const censita = await censisci(email);

        // Nessuna utenza dietro: è esattamente lo stato che la scuola produce.
        expect(await prisma().user.findFirst({ where: { personId: censita.id } })).toBeNull();

        const res = await registra(tag, email);
        expect(res.statusCode).toBe(201);

        // ── La prova vera ────────────────────────────────────────────────────
        // Nessuna seconda anagrafica: l'utenza si è agganciata a quella che
        // c'era. Senza la rivendicazione qui ci sarebbe stata una violazione del
        // vincolo unico su `Contact.email`, non un secondo record.
        const persone = await prisma().person.findMany({ where: { contact: { email } } });
        expect(persone).toHaveLength(1);
        expect(persone[0]!.id).toBe(censita.id);

        const utente = await prisma().user.findFirstOrThrow({ where: { person: { contact: { email } } } });
        expect(utente.personId).toBe(censita.id);
    });

    it("non riscrive l'anagrafica di chi rivendica (`RB32`)", async () => {
        const tag = unique("claim");
        const email = `${tag}@test.it`;
        const censita = await censisci(email, "Mariangela", "Rossi Bianchi");

        expect((await registra(tag, email)).statusCode).toBe(201);

        // Il nome che arriva dal modulo non è più autorevole di quello che
        // qualcuno ha già scritto: la persona corregge il proprio dall'area
        // personale, non questo percorso.
        const dopo = await prisma().person.findUniqueOrThrow({ where: { id: censita.id } });
        expect(dopo.name).toBe("Mariangela");
        expect(dopo.surname).toBe("Rossi Bianchi");
    });

    it("chi ha GIÀ un account continua a ricevere «accedi», non un secondo account", async () => {
        const tag = unique("dup");
        const email = `${tag}@test.it`;

        expect((await registra(tag, email)).statusCode).toBe(201);

        // Seconda registrazione con lo stesso indirizzo: il rifiuto di prima
        // resta, ed è quello giusto — qui un account esiste davvero.
        const res = await registra(`${tag}bis`, email);
        expect(res.statusCode).toBe(409);
        expect(res.json().code).toBe("EMAIL_ALREADY_REGISTERED");
    });

    it("rivendicare restituisce le iscrizioni fatte PRIMA che l'account esistesse", async () => {
        const tag = unique("past");
        const email = `${tag}@test.it`;
        const censita = await censisci(email);

        // La scuola l'ha iscritta a un evento mesi fa, quando non aveva un account.
        const scenario = await createEventScenario();
        await createTicketFor({
            eventId: scenario.event.id,
            ticketTypeId: scenario.ticketTypeId,
            role: DanceRole.FOLLOWER,
            personId: censita.id,
            holderName: "Maria",
            holderSurname: "Rossi",
        });

        // Oggi si registra.
        const res = await registra(tag, email);
        expect(res.statusCode).toBe(201);
        const utente = await prisma().user.findFirstOrThrow({ where: { person: { contact: { email } } } });
        await markEmailConfirmed(utente.id);

        // ── Il ritorno di tutto il lavoro ────────────────────────────────────
        // L'iscrizione compare da sé: puntava già alla sua anagrafica, e nessuna
        // riconciliazione è andata a cercarla.
        const session = await login(app, tag, PASSWORD);
        const mine = await app.inject({
            method: "GET",
            url: "/api/registrations/mine",
            headers: { authorization: session },
        });

        expect(mine.statusCode).toBe(200);
        const body = mine.json();
        const tutte = [...body.upcoming, ...body.past];
        expect(tutte).toHaveLength(1);
        expect(tutte[0].event.id).toBe(scenario.event.id);
    });
});
