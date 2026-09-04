import { DanceRole } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { login, markEmailConfirmed } from "../helpers";
import { createEventScenario } from "../fixtures/capacity";
import { createTicketFor, createDancer } from "../fixtures/tickets";

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

    // ═════════════════════════════════════════════════════════════════════════
    // Il censimento — `16` §3
    // ═════════════════════════════════════════════════════════════════════════

    describe("Il censimento dalla via manuale", () => {
        async function iscrivi(god: string, eventId: number, email: string, name = "Carla", surname = "Neri") {
            return app.inject({
                method: "POST",
                url: "/api/registrations/create",
                headers: { authorization: god },
                payload: {
                    eventId,
                    holderName: name,
                    holderSurname: surname,
                    holderEmail: email,
                    declaredRole: "FOLLOWER",
                },
            });
        }

        it("iscrivere qualcuno di sconosciuto lo CENSISCE, senza dargli un account", async () => {
            const god = await login(app, "god", "god");
            const scenario = await createEventScenario();
            const email = `${unique("cens")}@test.it`;

            const res = await iscrivi(god, scenario.event.id, email);
            expect(res.statusCode).toBe(200);
            expect(res.json().personId).toEqual(expect.any(Number));

            const persona = await prisma().person.findFirstOrThrow({
                where: { contact: { email } },
                include: { user: true },
            });
            expect(persona.name).toBe("Carla");
            // Censita, non registrata: nessuna utenza, e nessun modo di entrare.
            expect(persona.user).toBeNull();
            expect(res.json().personId).toBe(persona.id);
        });

        it("la stessa email su due eventi è UNA persona sola, non due", async () => {
            const god = await login(app, "god", "god");
            const primo = await createEventScenario();
            const secondo = await createEventScenario();
            const email = `${unique("stessa")}@test.it`;

            const a = await iscrivi(god, primo.event.id, email);
            const b = await iscrivi(god, secondo.event.id, email);
            expect(a.statusCode).toBe(200);
            expect(b.statusCode).toBe(200);

            // È il punto di tutto il documento: un ballerino, una riga.
            expect(b.json().personId).toBe(a.json().personId);
            expect(await prisma().person.count({ where: { contact: { email } } })).toBe(1);
        });

        it("il censimento COLLEGA e non riscrive (`RB32`)", async () => {
            const god = await login(app, "god", "god");
            const primo = await createEventScenario();
            const secondo = await createEventScenario();
            const email = `${unique("rb32")}@test.it`;

            await iscrivi(god, primo.event.id, email, "Carla", "Neri");
            // Una seconda organizzazione la iscrive scrivendo il nome più in fretta.
            await iscrivi(god, secondo.event.id, email, "C.", "N.");

            const persona = await prisma().person.findFirstOrThrow({ where: { contact: { email } } });
            expect(persona.name).toBe("Carla");
            expect(persona.surname).toBe("Neri");
        });

        it("due iscrizioni della stessa persona allo stesso evento sono rifiutate (`RB31`)", async () => {
            const god = await login(app, "god", "god");
            const scenario = await createEventScenario();
            const email = `${unique("rb31")}@test.it`;

            expect((await iscrivi(god, scenario.event.id, email)).statusCode).toBe(200);

            // Prima passava: senza anagrafica le due righe non si vedevano fra
            // loro, e consumavano capienza due volte.
            const seconda = await iscrivi(god, scenario.event.id, email);
            expect(seconda.statusCode).toBe(400);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // La ricerca dell'organizzatore — `16` §5
    // ═════════════════════════════════════════════════════════════════════════

    describe("La ricerca per email", () => {
        function cerca(session: string, email: string) {
            return app.inject({
                method: "GET",
                url: `/api/people/lookup?email=${encodeURIComponent(email)}`,
                headers: { authorization: session },
            });
        }

        it("chi non è mai passato di qui risponde «non trovato», non 404", async () => {
            const god = await login(app, "god", "god");
            const res = await cerca(god, `${unique("mai")}@test.it`);

            // Non trovare è il caso NORMALE: un 404 costringerebbe il chiamante a
            // trattare come eccezione la regola.
            expect(res.statusCode).toBe(200);
            expect(res.json().found).toBe(false);
            expect(res.json().personId).toBeNull();
        });

        it("trova chi è censito senza account, e lo dice", async () => {
            const god = await login(app, "god", "god");
            const email = `${unique("cerca")}@test.it`;
            const censita = await censisci(email, "Ada", "Bruni");

            const body = (await cerca(god, email)).json();
            expect(body.found).toBe(true);
            expect(body.personId).toBe(censita.id);
            expect(body.name).toBe("Ada");
            expect(body.surname).toBe("Bruni");
            expect(body.hasAccount).toBe(false);
            // Nessun account, nessun profilo di ballo da mostrare.
            expect(body.dancerProfile).toBeNull();
        });

        it("mostra il profilo di ballo di chi non l'ha nascosto (A7)", async () => {
            const god = await login(app, "god", "god");
            const dancer = await createDancer({ preferredRole: "FOLLOWER" });
            const contact = await prisma().contact.findFirstOrThrow({
                where: { person: { user: { id: dancer.user.id } } },
            });

            const body = (await cerca(god, contact.email)).json();
            expect(body.found).toBe(true);
            expect(body.hasAccount).toBe(true);
            // I tre campi che alimentano le quote di ruolo: è la ragione per cui
            // il profilo si mostra.
            expect(body.dancerProfile).not.toBeNull();
            expect(body.dancerProfile.preferredRole).toBe("FOLLOWER");
        });

        it("NON mostra il profilo di chi ha spento l'interruttore (A10)", async () => {
            const god = await login(app, "god", "god");
            const dancer = await createDancer({ preferredRole: "LEADER" });
            const contact = await prisma().contact.findFirstOrThrow({
                where: { person: { user: { id: dancer.user.id } } },
            });

            await prisma().dancerProfile.update({
                where: { userId: dancer.user.id },
                data: { profileVisibleToOrganizers: false },
            });

            const body = (await cerca(god, contact.email)).json();
            // L'anagrafica resta — serve a non censire due volte — ma il profilo no.
            expect(body.found).toBe(true);
            expect(body.name).not.toBeNull();
            expect(body.dancerProfile).toBeNull();
        });

        it("non ammette una ricerca parziale: è il presidio che regge (§5.1)", async () => {
            const god = await login(app, "god", "god");
            const email = `${unique("parz")}@test.it`;
            await censisci(email);

            // Un prefisso non è un indirizzo, e lo schema lo rifiuta prima del
            // servizio: senza questo la rotta enumererebbe la piattaforma.
            const res = await cerca(god, email.split("@")[0]!);
            expect(res.statusCode).toBe(400);
        });

        it("è chiusa a chi non può iscrivere nessuno", async () => {
            const dancer = await createDancer({});
            const session = await login(app, dancer.user.username, "secret");
            const res = await cerca(session, `${unique("vietato")}@test.it`);
            expect(res.statusCode).toBe(403);
        });
    });
});
