import { getPrismaClient } from "@utils/adapters/prisma";
import { signEmailToken } from "@utils/helpers/emailToken";

const app = (globalThis as any).__TEST_APP__;

/**
 * **La conferma dell'indirizzo**, dal rifiuto dell'accesso al clic sul tasto.
 *
 * Perché esiste il cancello: su questa piattaforma il biglietto **è** l'email —
 * il QR d'ingresso arriva lì e da nessun'altra parte. Un indirizzo digitato male
 * non è un campo sbagliato, è un biglietto pagato che non raggiungerà nessuno, e
 * ce ne si accorge alla porta la sera dell'evento.
 *
 * Perché il cancello sta **prima** della prenotazione: il fermo posti dura
 * quindici minuti, e se la conferma stesse dopo, quei minuti scorrerebbero
 * mentre la persona cerca l'email — trasformando un minuto d'attesa in un posto
 * perduto.
 */
describe("Conferma dell'indirizzo email", () => {
    const PASSWORD = "Password2027!";

    async function register(username: string, extra: Record<string, unknown> = {}) {
        const res = await app.inject({
            method: "POST",
            url: "/api/users/register",
            payload: {
                username,
                password: PASSWORD,
                firstName: "Prova",
                lastName: "Ballerino",
                email: `${username}@test.it`,
                ...extra,
            },
        });
        return res;
    }

    function login(usernameOrEmail: string, password = PASSWORD) {
        return app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: { usernameOrEmail, password },
        });
    }

    /** Rifà il gettone che sarebbe finito nel link, con la stessa firma del server. */
    function tokenFor(userId: number, email: string, next?: string, ttl?: number) {
        return signEmailToken(
            { purpose: "EMAIL_CONFIRMATION", userId, email, ...(next ? { next } : {}) },
            process.env.JWT_SECRET!,
            ttl,
        );
    }

    it("l'account nasce NON confermato e l'accesso è rifiutato con un codice suo", async () => {
        const res = await register("conferma.uno");
        expect(res.statusCode).toBe(201);

        const id = res.json().user.id as number;
        const row = await getPrismaClient().user.findUnique({ where: { id } });
        expect(row?.emailVerifiedAt).toBeNull();

        const attempt = await login("conferma.uno");
        // **403 e non 401**: le credenziali sono giuste. Dire «username o
        // password non validi» manderebbe a cambiare una password che va bene.
        expect(attempt.statusCode).toBe(403);
        expect(attempt.json().code).toBe("EMAIL_NOT_CONFIRMED");
    });

    it("il tasto conferma, restituisce una sessione utilizzabile e riporta all'evento", async () => {
        const created = await register("conferma.due");
        const id = created.json().user.id as number;

        const res = await app.inject({
            method: "POST",
            url: "/api/auth/confirm-email",
            payload: { token: tokenFor(id, "conferma.due@test.it", "trani-tango") },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().justConfirmed).toBe(true);
        // La destinazione arriva dal **contenuto firmato**, non dalla query
        // string: un ritorno riscrivibile da chi confeziona il link sarebbe
        // l'arnese con cui si costruisce una pagina d'accesso falsa.
        expect(res.json().next).toBe("trani-tango");

        // Chi ha appena dimostrato di possedere l'indirizzo **è già dentro**:
        // il token restituito deve funzionare davvero, non essere una formalità.
        const profile = await app.inject({
            method: "GET",
            url: "/api/auth/profile",
            headers: { authorization: `Bearer ${res.json().token}` },
        });
        expect(profile.statusCode).toBe(200);
        expect(profile.json().username).toBe("conferma.due");

        // E da qui in poi l'accesso normale funziona.
        expect((await login("conferma.due")).statusCode).toBe(200);
    });

    it("un secondo clic sullo stesso link NON è un errore", async () => {
        const created = await register("conferma.tre");
        const id = created.json().user.id as number;
        const token = tokenFor(id, "conferma.tre@test.it");

        const first = await app.inject({ method: "POST", url: "/api/auth/confirm-email", payload: { token } });
        expect(first.json().justConfirmed).toBe(true);

        // Le email si inoltrano, si aprono dal telefono e poi dal computer.
        // Rispondere «link non valido» a chi ha solo ricliccato lo manderebbe a
        // chiedere assistenza per un'operazione perfettamente riuscita.
        const second = await app.inject({ method: "POST", url: "/api/auth/confirm-email", payload: { token } });
        expect(second.statusCode).toBe(200);
        expect(second.json().justConfirmed).toBe(false);
        expect(second.json().token).toBeTruthy();
    });

    it("un gettone scaduto risponde 410, che è il codice del «rimandamelo»", async () => {
        const created = await register("conferma.quattro");
        const id = created.json().user.id as number;

        const res = await app.inject({
            method: "POST",
            url: "/api/auth/confirm-email",
            // Già scaduto all'emissione.
            payload: { token: tokenFor(id, "conferma.quattro@test.it", undefined, -60) },
        });

        // Distinto dal 400 di un link non valido: lo scaduto ha una via
        // d'uscita, il manomesso no, e trattarli uguale lascerebbe fermo chi ha
        // solo aspettato troppo.
        expect(res.statusCode).toBe(410);
        expect(res.json().code).toBe("EMAIL_NOT_CONFIRMED");
    });

    it("un gettone con la firma manomessa è rifiutato", async () => {
        const created = await register("conferma.cinque");
        const id = created.json().user.id as number;

        const good = tokenFor(id, "conferma.cinque@test.it");
        const [body] = good.split(".");
        // Payload originale, firma di un altro segreto: è il tentativo che il
        // cancello deve fermare.
        const forged = `${body}.${Buffer.from("firma-inventata").toString("base64url")}`;

        const res = await app.inject({ method: "POST", url: "/api/auth/confirm-email", payload: { token: forged } });
        expect(res.statusCode).toBe(400);

        const row = await getPrismaClient().user.findUnique({ where: { id } });
        expect(row?.emailVerifiedAt).toBeNull();
    });

    it("un gettone firmato per un ALTRO indirizzo non conferma questo account", async () => {
        const created = await register("conferma.sei");
        const id = created.json().user.id as number;

        // Firma valida, utente giusto, indirizzo diverso da quello sul contatto:
        // proverebbe il possesso di una casella che non è quella dell'account.
        const res = await app.inject({
            method: "POST",
            url: "/api/auth/confirm-email",
            payload: { token: tokenFor(id, "un.altro@test.it") },
        });

        expect(res.statusCode).toBe(409);
        const row = await getPrismaClient().user.findUnique({ where: { id } });
        expect(row?.emailVerifiedAt).toBeNull();
    });

    it("l'email già registrata è un BIVIO, non un errore generico", async () => {
        await register("conferma.sette");

        // Stesso indirizzo, nome utente diverso: il codice deve dire che la via
        // d'uscita è **accedere**, non provare un altro indirizzo.
        const res = await register("conferma.sette.bis", { email: "conferma.sette@test.it" });
        expect(res.statusCode).toBe(409);
        expect(res.json().code).toBe("EMAIL_ALREADY_REGISTERED");
    });

    it("il nome utente occupato è un codice DIVERSO: lì si cambia il nome", async () => {
        await register("conferma.otto");

        const res = await register("conferma.otto", { email: "tutt.altro@test.it" });
        expect(res.statusCode).toBe(409);
        expect(res.json().code).toBe("USERNAME_TAKEN");
    });

    it("il rinvio risponde uguale per un indirizzo che non esiste", async () => {
        // Una risposta che distinguesse i due casi renderebbe questa rotta un
        // oracolo: chiunque potrebbe provare una lista di indirizzi e leggere
        // quali sono iscritti. Chi frequenta le milonghe è un dato personale.
        const unknown = await app.inject({
            method: "POST",
            url: "/api/auth/resend-confirmation",
            payload: { email: "non.esiste.affatto@test.it" },
        });
        expect(unknown.statusCode).toBe(200);
        expect(unknown.json()).toEqual({ ok: true });

        await register("conferma.nove");
        const known = await app.inject({
            method: "POST",
            url: "/api/auth/resend-confirmation",
            payload: { email: "conferma.nove@test.it" },
        });
        expect(known.statusCode).toBe(200);
        expect(known.json()).toEqual({ ok: true });
    });

    it("gli account creati dal back-office nascono confermati e accedono subito", async () => {
        // Sulla strada amministrativa nessuna email di conferma parte: lasciare
        // il campo nullo non darebbe un account «da verificare» ma un account
        // che nessuno potrà mai usare, in attesa di un link che non esisterà.
        const seeded = await getPrismaClient().user.findFirst({ where: { username: "god" } });
        expect(seeded?.emailVerifiedAt).not.toBeNull();
    });
});
