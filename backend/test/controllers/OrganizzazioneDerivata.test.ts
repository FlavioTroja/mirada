import { getPrismaClient } from "@utils/adapters/prisma";
import { login } from "../helpers";
import { createEventScenario } from "../fixtures/capacity";
import { encryptPasswordSync } from "@utils/helpers/crypto";

const app = (globalThis as any).__TEST_APP__;

let sequence = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${++sequence}`;

/**
 * **L'organizzazione di una riga nuova la decide il server** — non il corpo
 * della richiesta.
 *
 * ── Il difetto che queste prove chiudono (4 settembre 2026) ──────────────────
 * `isWritableOrganization` pretende un `organizationId`: **assente vale come non
 * autorizzato**. Le pagine Location e Cast non lo mandavano, e in produzione
 * creare una sala rispondeva
 *
 *     403 — «Non hai i permessi per operare su questa organizzazione»
 *
 * a un `OWNER` che i permessi ce li aveva. Il messaggio accusava il chiamante di
 * un problema che non aveva: l'organizzazione ce l'aveva, non l'aveva **detta**.
 *
 * Il difetto era in **sette** servizi con la stessa forma; due erano raggiungibili
 * dall'interfaccia, e nessuno dei due falliva in compilazione. La correzione non
 * sta nelle due pagine: sta nel server, che quel dato lo conosce già.
 */
describe("L'organizzazione la deriva il server", () => {
    const PASSWORD = "secret";
    const prisma = () => getPrismaClient();

    /** Un titolare con UNA organizzazione, come ogni cliente reale. */
    async function titolare() {
        const scenario = await createEventScenario();
        const tag = unique("owner");
        const user = await prisma().user.create({
            data: {
                username: tag,
                password: encryptPasswordSync(PASSWORD),
                emailVerifiedAt: new Date(),
                roles: { create: { roleName: "OWNER", isActive: true } },
                // Annidato e non per `personId`: con una scrittura annidata
                // Prisma non accetta lo scalare della stessa relazione.
                person: {
                    create: {
                        name: "Titolare",
                        surname: tag,
                        personType: "USER",
                        contact: { create: { email: `${tag}@test.it` } },
                    },
                },
            },
        });
        await prisma().organizationMember.create({
            data: {
                organizationId: scenario.organizationId,
                userId: user.id,
                role: "OWNER",
                acceptedAt: new Date(),
            },
        });
        return { user, organizationId: scenario.organizationId, username: tag };
    }

    it("crea una sala SENZA che il client dica l'organizzazione — era il 403 di produzione", async () => {
        const owner = await titolare();
        const session = await login(app, owner.username, PASSWORD);
        const address = await prisma().address.create({ data: { city: "Bari", country: "IT" } });

        // Esattamente il corpo che mandava il back-office: nessun organizationId.
        const res = await app.inject({
            method: "POST",
            url: "/api/venues/create",
            headers: { authorization: session },
            payload: { name: "Invito alla Danza", addressId: address.id, capacity: 60 },
        });

        expect(res.statusCode).toBe(200);
        // E la sala è SUA: derivata, non lasciata nulla — che avrebbe prodotto
        // una sala di piattaforma visibile a ogni organizzazione.
        expect(res.json().organizationId).toBe(owner.organizationId);
    });

    it("crea un artista senza organizzazione dichiarata, e gliela assegna", async () => {
        const owner = await titolare();
        const session = await login(app, owner.username, PASSWORD);

        const res = await app.inject({
            method: "POST",
            url: "/api/artists/create",
            headers: { authorization: session },
            payload: { name: "Duo Piazzolla", kind: "ORCHESTRA" },
        });

        expect(res.statusCode).toBe(200);
        expect(res.json().organizationId).toBe(owner.organizationId);
    });

    it("rifiuta ancora l'organizzazione di un ALTRO: derivare non è fidarsi", async () => {
        const owner = await titolare();
        const altrui = await createEventScenario();
        const session = await login(app, owner.username, PASSWORD);
        const address = await prisma().address.create({ data: { city: "Bari", country: "IT" } });

        const res = await app.inject({
            method: "POST",
            url: "/api/venues/create",
            headers: { authorization: session },
            payload: {
                name: "Sala altrui",
                addressId: address.id,
                organizationId: altrui.organizationId,
            },
        });

        // L'isolamento di §1.5 resta intatto: si deriva ciò che manca, non si
        // accetta ciò che è dichiarato male.
        expect(res.statusCode).toBe(403);
    });

    it("GOD continua a poter creare una sala DI PIATTAFORMA", async () => {
        const god = await login(app, "god", "god");
        const address = await prisma().address.create({ data: { city: "Roma", country: "IT" } });

        const res = await app.inject({
            method: "POST",
            url: "/api/venues/create",
            headers: { authorization: god },
            payload: { name: "Sala condivisa", addressId: address.id },
        });

        expect(res.statusCode).toBe(200);
        // Nulla = riga di piattaforma, condivisa. È il caso che la derivazione
        // NON deve rompere: `GOD` non ha appartenenze da cui dedurre.
        expect(res.json().organizationId).toBeNull();
    });
});
