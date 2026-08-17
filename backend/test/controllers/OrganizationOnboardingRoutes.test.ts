import { OrgMemberRole, RoleName } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { login, markEmailConfirmed } from "../helpers";

const app = (globalThis as any).__TEST_APP__;

/**
 * **L'apertura di un cliente della piattaforma** — §4.2.
 *
 * Nel primo taglio solo `GOD` crea organizzazioni: nessun ruolo possiede una
 * riga `CREATE` su `ORGANIZATION`, e il Super Admin passa per l'allow-all
 * implicito. Ma «creata da `GOD`» non vuol dire «di `GOD`», ed è la distinzione
 * che questi test difendono.
 *
 * Il rischio da cui proteggono non è teorico: prima, chi creava diventava
 * proprietario, e siccome a creare è sempre il Super Admin, quest'ultimo
 * finiva membro di **ogni** cliente della piattaforma — con i segnali in tempo
 * reale di tutti recapitati a lui. Ed erano tre scritture indipendenti che
 * nessuno legava: bastava dimenticarne una per ottenere un cliente a metà,
 * senza che nulla fallisse.
 */
describe("Apertura di un'organizzazione (§4.2)", () => {
    let god: string;

    const BASE = {
        legalName: "Prova SRL",
        legalForm: "SRL",
        contactEmail: "prova@test.it",
    };

    /** Un utente qualunque, destinato a diventare titolare. */
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
        // L'auto-registrazione risponde `201`, a differenza del resto del
        // dialetto che risponde `200` (§3.3), e il corpo è
        // `{ user, confirmationSent }`: l'account nasce da confermare, e chi
        // chiama deve sapere se l'email di conferma è partita davvero.
        expect(res.statusCode).toBe(201);
        const id = res.json().user.id as number;
        // Il candidato deve poter **accedere**, e da quando la conferma è
        // obbligatoria un account appena registrato non può. Qui si simula il
        // clic sul tasto dell'email; il percorso vero è provato in
        // `EmailConfirmation.test.ts`.
        await markEmailConfirmed(id);
        return id;
    }

    beforeAll(async () => {
        god = await login(app, "god", "god");
    });

    it("RIFIUTA la creazione se il Super Admin non designa un titolare", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/organizations/create",
            headers: { authorization: god },
            payload: { name: "Senza titolare", ...BASE },
        });

        expect(res.statusCode).toBe(400);
        // Non deve restare nulla: né l'organizzazione né una membership orfana.
        const orphan = await getPrismaClient().organization.findFirst({ where: { name: "Senza titolare" } });
        expect(orphan).toBeNull();
    });

    it("RIFIUTA un titolare inesistente, senza creare l'organizzazione", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/organizations/create",
            headers: { authorization: god },
            payload: { name: "Titolare fantasma", ...BASE, ownerUserId: 999999 },
        });

        expect(res.statusCode).toBe(400);
        const orphan = await getPrismaClient().organization.findFirst({ where: { name: "Titolare fantasma" } });
        expect(orphan).toBeNull();
    });

    it("apre organizzazione, membership OWNER e ruolo OWNER in un atto solo", async () => {
        const ownerId = await createCandidate("titolare.uno");

        const res = await app.inject({
            method: "POST",
            url: "/api/organizations/create",
            headers: { authorization: god },
            payload: { name: "Tango Club Prova", ...BASE, ownerUserId: ownerId },
        });
        expect(res.statusCode).toBe(200);
        const organizationId = res.json().id as number;

        const prisma = getPrismaClient();

        // 1. La membership: senza, lo scope `#OWN` non ha su cosa realizzarsi e
        //    l'organizzazione è irraggiungibile per chiunque non sia GOD.
        const membership = await prisma.organizationMember.findFirst({
            where: { organizationId, userId: ownerId, deleted: false },
        });
        expect(membership?.role).toBe(OrgMemberRole.OWNER);

        // 2. Il ruolo: `OrgMemberRole` e `RoleName` sono due enum distinti con gli
        //    stessi nomi, e la sola membership non concede alcun permesso.
        const role = await prisma.roleToUser.findFirst({
            where: { userId: ownerId, roleName: RoleName.OWNER },
        });
        expect(role).not.toBeNull();
        expect(role?.isActive).toBe(true);

        // 3. Il Super Admin NON è membro: apre per conto d'altri, non per sé.
        const godMembership = await prisma.organizationMember.findFirst({
            where: { organizationId, user: { username: "god" } },
        });
        expect(godMembership).toBeNull();
    });

    it("il titolare vede e amministra la propria, e NON esiste per lui quella altrui", async () => {
        const [primoId, secondoId] = await Promise.all([
            createCandidate("titolare.due"),
            createCandidate("titolare.tre"),
        ]);

        const created = await Promise.all([
            app.inject({
                method: "POST", url: "/api/organizations/create", headers: { authorization: god },
                payload: { name: "Club Alfa", ...BASE, ownerUserId: primoId },
            }),
            app.inject({
                method: "POST", url: "/api/organizations/create", headers: { authorization: god },
                payload: { name: "Club Beta", ...BASE, ownerUserId: secondoId },
            }),
        ]);
        const alfaId = created[0].json().id as number;
        const betaId = created[1].json().id as number;

        const primo = await login(app, "titolare.due", "Password2027!");

        // Vede la propria e **solo** quella.
        const list = await app.inject({
            method: "POST", url: "/api/organizations/", headers: { authorization: primo },
            payload: { query: {}, options: {} },
        });
        expect(list.statusCode).toBe(200);
        expect(list.json().docs.map((o: { id: number }) => o.id)).toEqual([alfaId]);

        // La amministra: il ruolo OWNER concesso all'apertura è ciò che glielo
        // permette — con la sola membership riceverebbe 403.
        const own = await app.inject({
            method: "PATCH", url: `/api/organizations/${alfaId}`, headers: { authorization: primo },
            payload: { website: "https://alfa.test" },
        });
        expect(own.statusCode).toBe(200);
        expect(own.json().website).toBe("https://alfa.test");

        // Quella altrui non è vietata: **non esiste**. Un 403 confermerebbe che
        // c'è qualcosa a quell'id, e il §1.5 non concede nemmeno quello.
        const other = await app.inject({
            method: "PATCH", url: `/api/organizations/${betaId}`, headers: { authorization: primo },
            payload: { website: "https://dirottata.test" },
        });
        expect(other.statusCode).toBe(404);

        const beta = await getPrismaClient().organization.findUnique({ where: { id: betaId } });
        expect(beta?.website).not.toBe("https://dirottata.test");
    });

    it("aggiungere un membro gli concede il ruolo corrispondente", async () => {
        const ownerId = await createCandidate("titolare.cinque");
        const collaboratorId = await createCandidate("collaboratore.uno");

        const org = await app.inject({
            method: "POST", url: "/api/organizations/create", headers: { authorization: god },
            payload: { name: "Club con staff", ...BASE, ownerUserId: ownerId },
        });
        const organizationId = org.json().id as number;

        const added = await app.inject({
            method: "POST", url: "/api/organization-members/create", headers: { authorization: god },
            payload: { organizationId, userId: collaboratorId, role: OrgMemberRole.EVENT_MANAGER },
        });
        expect(added.statusCode).toBe(200);

        // Senza il ruolo sarebbe responsabile eventi di un'organizzazione su cui
        // non può fare nulla: la membership da sola non concede permessi.
        const role = await getPrismaClient().roleToUser.findFirst({
            where: { userId: collaboratorId, roleName: RoleName.EVENT_MANAGER },
        });
        expect(role).not.toBeNull();
    });

    it("rimuovere un membro gli REVOCA il ruolo che nessun'altra membership giustifica", async () => {
        const ownerId = await createCandidate("titolare.sei");
        const collaboratorId = await createCandidate("collaboratore.due");

        const org = await app.inject({
            method: "POST", url: "/api/organizations/create", headers: { authorization: god },
            payload: { name: "Club che licenzia", ...BASE, ownerUserId: ownerId },
        });
        const organizationId = org.json().id as number;

        const added = await app.inject({
            method: "POST", url: "/api/organization-members/create", headers: { authorization: god },
            payload: { organizationId, userId: collaboratorId, role: OrgMemberRole.CHECKIN_OPERATOR },
        });
        const memberId = added.json().id as number;

        const removed = await app.inject({
            method: "DELETE", url: `/api/organization-members/${memberId}`, headers: { authorization: god },
        });
        expect(removed.statusCode).toBe(200);

        // Il ruolo residuo non è un dettaglio contabile: sarebbe tornato utile
        // alla prima organizzazione ricapitata sotto lo scope.
        const role = await getPrismaClient().roleToUser.findFirst({
            where: { userId: collaboratorId, roleName: RoleName.CHECKIN_OPERATOR },
        });
        expect(role).toBeNull();
    });

    it("uscire da UNA sola organizzazione non fa perdere il ruolo tenuto altrove", async () => {
        const ownerId = await createCandidate("titolare.sette");

        const ids: number[] = [];
        for (const name of ["Casa nord", "Casa sud"]) {
            const res = await app.inject({
                method: "POST", url: "/api/organizations/create", headers: { authorization: god },
                payload: { name, ...BASE, ownerUserId: ownerId },
            });
            ids.push(res.json().id as number);
        }

        const memberships = await getPrismaClient().organizationMember.findMany({
            where: { userId: ownerId, deleted: false },
        });
        expect(memberships).toHaveLength(2);
        const [first] = memberships;

        const removed = await app.inject({
            method: "DELETE", url: `/api/organization-members/${first!.id}`, headers: { authorization: god },
        });
        expect(removed.statusCode).toBe(200);

        // Una riconciliazione ingenua «tolgo il ruolo quando esce» qui gli
        // toglierebbe l'accesso all'organizzazione che possiede ancora.
        const role = await getPrismaClient().roleToUser.findFirst({
            where: { userId: ownerId, roleName: RoleName.OWNER },
        });
        expect(role).not.toBeNull();
        expect(ids).toHaveLength(2);
    });

    it("un secondo cliente dello stesso titolare non fallisce sul ruolo già concesso", async () => {
        const ownerId = await createCandidate("titolare.quattro");

        for (const name of ["Prima casa", "Seconda casa"]) {
            const res = await app.inject({
                method: "POST", url: "/api/organizations/create", headers: { authorization: god },
                payload: { name, ...BASE, ownerUserId: ownerId },
            });
            // `RoleToUser` ha un vincolo di unicità su (roleName, userId): un
            // inserimento cieco al secondo giro farebbe fallire la transazione,
            // e con essa l'organizzazione.
            expect(res.statusCode).toBe(200);
        }

        const roles = await getPrismaClient().roleToUser.count({
            where: { userId: ownerId, roleName: RoleName.OWNER },
        });
        expect(roles).toBe(1);
    });
});
