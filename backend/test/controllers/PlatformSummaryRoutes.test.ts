import { getPrismaClient } from "@utils/adapters/prisma";
import { login, markEmailConfirmed } from "../helpers";

const app = (globalThis as any).__TEST_APP__;

/**
 * `GET /platform/summary` — il riepilogo di **chi gestisce la piattaforma**.
 *
 * È l'unica lettura che attraversa deliberatamente tutte le organizzazioni, e
 * per questo la barriera è il **ruolo** e non un permesso: `READ#ORGANIZATION#ALL`
 * lo possiede anche un `OWNER`, e con quello un titolare leggerebbe gli eventi e
 * gli incassi dei concorrenti. Il §1.5 non concede a un tenant nemmeno un
 * conteggio aggregato di un'organizzazione altrui — ed è esattamente ciò che
 * questa rotta restituisce.
 */
describe("Riepilogo di piattaforma (§4.10)", () => {
    let god: string;

    const BASE = { legalName: "Prova SRL", legalForm: "SRL", contactEmail: "prova@test.it" };

    async function createCandidate(username: string) {
        const res = await app.inject({
            method: "POST",
            url: "/api/users/register",
            payload: {
                username,
                password: "Password2027!",
                firstName: "Prova",
                lastName: "Titolare",
                email: `${username}@test.it`,
            },
        });
        expect(res.statusCode).toBe(201);
        // `{ user, confirmationSent }`: l'account nasce da confermare, e il
        // titolare qui sotto deve poter accedere.
        const id = res.json().user.id as number;
        await markEmailConfirmed(id);
        return id;
    }

    beforeAll(async () => {
        god = await login(app, "god", "god");
    });

    it("è NEGATO a un OWNER: leggerebbe gli incassi dei concorrenti", async () => {
        const ownerId = await createCandidate("riepilogo.titolare");
        await app.inject({
            method: "POST", url: "/api/organizations/create", headers: { authorization: god },
            payload: { name: "Club curioso", ...BASE, ownerUserId: ownerId },
        });

        const owner = await login(app, "riepilogo.titolare", "Password2027!");
        const res = await app.inject({
            method: "GET", url: "/api/platform/summary", headers: { authorization: owner },
        });

        expect(res.statusCode).toBe(403);
    });

    it("è NEGATO senza sessione", async () => {
        const res = await app.inject({ method: "GET", url: "/api/platform/summary" });
        expect(res.statusCode).toBe(401);
    });

    it("riporta ogni organizzazione con i suoi titolari, anche senza eventi", async () => {
        const [primoId, secondoId] = await Promise.all([
            createCandidate("riepilogo.uno"),
            createCandidate("riepilogo.due"),
        ]);

        await app.inject({
            method: "POST", url: "/api/organizations/create", headers: { authorization: god },
            payload: { name: "Club Riepilogo Alfa", ...BASE, ownerUserId: primoId },
        });
        const beta = await app.inject({
            method: "POST", url: "/api/organizations/create", headers: { authorization: god },
            payload: { name: "Club Riepilogo Beta", ...BASE, ownerUserId: secondoId },
        });
        const betaId = beta.json().id as number;

        const res = await app.inject({
            method: "GET", url: "/api/platform/summary", headers: { authorization: god },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        // Il conteggio è quello reale del database, non quello dei soli
        // record creati qui: altre suite popolano la stessa istanza.
        const organizations = await getPrismaClient().organization.count({ where: { deleted: false } });
        expect(body.organizations.total).toBe(organizations);

        const row = body.byOrganization.find((o: { organizationId: number }) => o.organizationId === betaId);
        expect(row).toBeDefined();
        expect(row.owners.map((o: { username: string }) => o.username)).toEqual(["riepilogo.due"]);
        // Un cliente senza eventi compare a zero, non sparisce: «nessun evento»
        // è proprio la notizia che chi gestisce la piattaforma deve vedere.
        expect(row.events).toBe(0);
        expect(row.registrations).toBe(0);
        expect(row.revenue).toBe(0);
    });

    it("dichiara il perimetro e tiene distinti impegnato e venduto (RB21)", async () => {
        const res = await app.inject({
            method: "GET", url: "/api/platform/summary", headers: { authorization: god },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();

        expect(body.perimeter.missingEntities).toEqual(["Refund"]);
        expect(body.perimeter.note).toContain("RB21");

        // Due grandezze, due campi: chi le fondesse annuncerebbe come venduto
        // ciò che una prenotazione scaduta restituisce.
        expect(body.registrations).toHaveProperty("total");
        expect(body.revenue).toHaveProperty("total");
        expect(body.revenue).toHaveProperty("presaleRights");
        expect(body.revenue).toHaveProperty("subtotal");
    });
});
