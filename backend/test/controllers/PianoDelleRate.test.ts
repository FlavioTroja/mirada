import { DeclaredDanceRole } from "@prisma/client";
import { getPrismaClient } from "@utils/adapters/prisma";
import { login } from "../helpers";
import { createEventScenario } from "../fixtures/capacity";

const app = (globalThis as any).__TEST_APP__;

let sequence = 0;
const unique = (p: string) => `${p}${Date.now().toString(36)}${++sequence}`;

const GIORNO = 86_400_000;
const fa = (giorni: number) => new Date(Date.now() - giorni * GIORNO).toISOString();
const fra = (giorni: number) => new Date(Date.now() + giorni * GIORNO).toISOString();

/**
 * **Il piano delle rate** — `18-rate.md`.
 *
 * Incassare a rate funzionava già: il dovuto sull'iscrizione, e tante righe di
 * `BalanceSettlement` quante ne servono. Ciò che mancava era sapere **quando** le
 * rate erano attese, e quindi **chi è indietro**.
 *
 * La regola che tutte queste prove difendono è che una rata **non ha uno stato
 * «pagata»** (`RB34`): il piano è una previsione, i versamenti sono i fatti, e il
 * ritardo è il confronto fra i due. Se un giorno qualcuno aggiungesse quella
 * spunta, la terza prova qui sotto continuerebbe a passare e le altre no.
 */
describe("Il piano delle rate", () => {
    const prisma = () => getPrismaClient();

    async function iscrittoCon180(god: string) {
        const scenario = await createEventScenario();
        const res = await app.inject({
            method: "POST",
            url: "/api/registrations/enrol",
            headers: { authorization: god },
            payload: {
                eventId: scenario.event.id,
                ticketTypeId: scenario.ticketTypeId,
                holderName: "Marta",
                holderSurname: "Conti",
                holderEmail: `${unique("rate")}@test.it`,
                declaredRole: DeclaredDanceRole.FOLLOWER,
            },
        });
        expect(res.statusCode).toBe(200);
        // Il fixture vende un Full Pass a 9.000 centesimi.
        expect(res.json().dueAmount).toBe(9_000);
        return res.json().registration.id as number;
    }

    function scrivi(god: string, id: number, instalments: unknown[]) {
        return app.inject({
            method: "PATCH",
            url: `/api/balance-settlements/registration/${id}/plan`,
            headers: { authorization: god },
            payload: { instalments },
        });
    }

    function leggi(god: string, id: number) {
        return app.inject({
            method: "GET",
            url: `/api/balance-settlements/registration/${id}`,
            headers: { authorization: god },
        });
    }

    function incassa(god: string, id: number, amount: number) {
        return app.inject({
            method: "POST",
            url: "/api/balance-settlements/create",
            headers: { authorization: god },
            payload: { registrationId: id, amount, method: "CASH" },
        });
    }

    it("scrive un piano di tre rate che somma al dovuto", async () => {
        const god = await login(app, "god", "god");
        const id = await iscrittoCon180(god);

        const res = await scrivi(god, id, [
            { amount: 3_000, dueAt: fra(1) },
            { amount: 3_000, dueAt: fra(31) },
            { amount: 3_000, dueAt: fra(61) },
        ]);

        expect(res.statusCode).toBe(200);
        expect(res.json().instalments).toHaveLength(3);
        // Nessuno è ancora in ritardo: la prima rata scade domani.
        expect(res.json().overdueAmount).toBe(0);
    });

    it("RIFIUTA un piano che non torna, e dice di quanto sbaglia (`RB35`)", async () => {
        const god = await login(app, "god", "god");
        const id = await iscrittoCon180(god);

        const res = await scrivi(god, id, [
            { amount: 3_000, dueAt: fra(1) },
            { amount: 3_000, dueAt: fra(31) },
        ]);

        expect(res.statusCode).toBe(400);
        // Il messaggio porta entrambe le cifre: correggerlo in silenzio
        // significherebbe decidere al posto di chi il piano l'ha concordato.
        expect(res.json().message).toContain("60.00");
        expect(res.json().message).toContain("90.00");
    });

    it("il ritardo è il CONFRONTO fra scadute e versato, non una spunta (`RB34`)", async () => {
        const god = await login(app, "god", "god");
        const id = await iscrittoCon180(god);

        // Due rate già scadute, una futura.
        await scrivi(god, id, [
            { amount: 3_000, dueAt: fa(30) },
            { amount: 3_000, dueAt: fa(2) },
            { amount: 3_000, dueAt: fra(28) },
        ]);

        // Nessun versamento: sono scadute 60 €, in ritardo 60 €.
        let b = (await leggi(god, id)).json();
        expect(b.overdueAmount).toBe(6_000);

        // Versa la prima rata intera: resta scoperta la seconda.
        expect((await incassa(god, id, 3_000)).statusCode).toBe(200);
        b = (await leggi(god, id)).json();
        expect(b.overdueAmount).toBe(3_000);
        expect(b.settledAmount).toBe(3_000);

        // E la seconda: in pari, pur avendo ancora 30 € aperti in totale.
        await incassa(god, id, 3_000);
        b = (await leggi(god, id)).json();
        expect(b.overdueAmount).toBe(0);
        expect(b.openAmount).toBe(3_000);
    });

    it("RIFIUTA mezza rata, e dice la cifra giusta (`RB36`)", async () => {
        const god = await login(app, "god", "god");
        const id = await iscrittoCon180(god);
        await scrivi(god, id, [
            { amount: 3_000, dueAt: fa(2) },
            { amount: 3_000, dueAt: fra(28) },
            { amount: 3_000, dueAt: fra(58) },
        ]);

        // 60 è già di per sé una rata: non si rateizza ulteriormente.
        const res = await incassa(god, id, 5_000);
        expect(res.statusCode).toBe(400);
        // Allo sportello c'è qualcuno col portafoglio in mano: si dice quanto.
        expect(res.json().message).toContain("30.00");
    });

    it("ammette DUE rate insieme, che è un confine come un altro", async () => {
        const god = await login(app, "god", "god");
        const id = await iscrittoCon180(god);
        await scrivi(god, id, [
            { amount: 3_000, dueAt: fa(2) },
            { amount: 3_000, dueAt: fra(28) },
            { amount: 3_000, dueAt: fra(58) },
        ]);

        expect((await incassa(god, id, 6_000)).statusCode).toBe(200);
        const b = (await leggi(god, id)).json();
        expect(b.settledAmount).toBe(6_000);
        expect(b.overdueAmount).toBe(0);
    });

    it("SENZA un piano si versa quel che si vuole, come prima", async () => {
        const god = await login(app, "god", "god");
        const id = await iscrittoCon180(god);

        // Nessun piano, nessun confine: è il comportamento di chi non ha
        // concordato rate, e non deve cambiare.
        expect((await incassa(god, id, 1_234)).statusCode).toBe(200);
    });

    it("chi è in ANTICIPO risulta in pari, non in ritardo negativo", async () => {
        const god = await login(app, "god", "god");
        const id = await iscrittoCon180(god);
        await scrivi(god, id, [
            { amount: 3_000, dueAt: fa(2) },
            { amount: 3_000, dueAt: fra(28) },
            { amount: 3_000, dueAt: fra(58) },
        ]);

        // Scaduti 30 €, ne versa 90 — le tre rate insieme, che è un confine. Un
        // numero negativo si sommerebbe altrove e farebbe coprire un allievo
        // indietro da uno avanti.
        expect((await incassa(god, id, 9_000)).statusCode).toBe(200);
        const b = (await leggi(god, id)).json();
        expect(b.overdueAmount).toBe(0);
    });

    it("indica la prossima scadenza NON ancora coperta dai versamenti", async () => {
        const god = await login(app, "god", "god");
        const id = await iscrittoCon180(god);
        const seconda = fra(31);
        await scrivi(god, id, [
            { amount: 3_000, dueAt: fra(1) },
            { amount: 3_000, dueAt: seconda },
            { amount: 3_000, dueAt: fra(61) },
        ]);

        // Versata la prima: la prossima è la seconda.
        await incassa(god, id, 3_000);
        const b = (await leggi(god, id)).json();
        expect(new Date(b.nextDueAt).toISOString()).toBe(new Date(seconda).toISOString());
    });

    it("un array vuoto cancella il piano e torna al residuo aperto", async () => {
        const god = await login(app, "god", "god");
        const id = await iscrittoCon180(god);
        await scrivi(god, id, [{ amount: 9_000, dueAt: fa(10) }]);
        expect((await leggi(god, id)).json().overdueAmount).toBe(9_000);

        const res = await scrivi(god, id, []);
        expect(res.statusCode).toBe(200);
        const b = res.json();
        expect(b.instalments).toHaveLength(0);
        // Senza scadenze non si è mai in ritardo, e il dovuto resta intatto.
        expect(b.overdueAmount).toBe(0);
        expect(b.nextDueAt).toBeNull();
        expect(b.openAmount).toBe(9_000);
    });

    it("riscrivere il piano NON tocca i versamenti già registrati", async () => {
        const god = await login(app, "god", "god");
        const id = await iscrittoCon180(god);
        // Due rate, e si versa la prima: 40 € è un confine, quindi ammessa.
        await scrivi(god, id, [
            { amount: 4_000, dueAt: fra(10) },
            { amount: 5_000, dueAt: fra(40) },
        ]);
        expect((await incassa(god, id, 4_000)).statusCode).toBe(200);

        // Il piano si riorganizza; il denaro che qualcuno ha preso in mano no.
        await scrivi(god, id, [
            { amount: 4_000, dueAt: fa(1) },
            { amount: 5_000, dueAt: fra(30) },
        ]);

        const b = (await leggi(god, id)).json();
        expect(b.settledAmount).toBe(4_000);
        expect(b.settlements).toHaveLength(1);
        expect(b.overdueAmount).toBe(0);
    });

    it("rifiuta un piano su un'iscrizione che non deve nulla", async () => {
        const god = await login(app, "god", "god");
        const scenario = await createEventScenario();
        const reg = await prisma().registration.create({
            data: {
                eventId: scenario.event.id,
                holderName: "Senza",
                holderSurname: "Dovuto",
                holderEmail: `${unique("nodue")}@test.it`,
                declaredRole: DeclaredDanceRole.FLEXIBLE,
            },
        });

        const res = await scrivi(god, reg.id, [{ amount: 1_000, dueAt: fra(5) }]);
        expect(res.statusCode).toBe(400);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // «Tre rate mensili da ottobre» — la generazione
    // ═════════════════════════════════════════════════════════════════════════

    describe("La generazione del piano", () => {
        function genera(god: string, id: number, count: number, firstDueAt: string) {
            return app.inject({
                method: "POST",
                url: `/api/balance-settlements/registration/${id}/plan/generate`,
                headers: { authorization: god },
                payload: { count, firstDueAt },
            });
        }

        it("genera tre rate mensili che sommano al dovuto", async () => {
            const god = await login(app, "god", "god");
            const id = await iscrittoCon180(god);

            const res = await genera(god, id, 3, "2026-10-01T00:00:00.000Z");
            expect(res.statusCode).toBe(200);

            const rate = res.json().instalments;
            expect(rate).toHaveLength(3);
            expect(rate.reduce((t: number, r: any) => t + r.amount, 0)).toBe(9_000);
            // Di mese in mese: ottobre, novembre, dicembre.
            const mesi = rate.map((r: any) => new Date(r.dueAt).getMonth());
            expect(mesi).toEqual([9, 10, 11]);
        });

        it("il resto va ai primi, e la somma torna al centesimo", async () => {
            const god = await login(app, "god", "god");
            const scenario = await createEventScenario();
            // Un titolo da 100,00 € in tre rate: 33,34 · 33,33 · 33,33.
            const titolo = await prisma().ticketType.create({
                data: { eventId: scenario.event.id, name: { it: "Trimestre" }, basePrice: 10_000 },
            });
            const iscr = await app.inject({
                method: "POST",
                url: "/api/registrations/enrol",
                headers: { authorization: god },
                payload: {
                    eventId: scenario.event.id,
                    ticketTypeId: titolo.id,
                    holderName: "Ada",
                    holderSurname: "Bruni",
                    holderEmail: `${unique("terzi")}@test.it`,
                    declaredRole: DeclaredDanceRole.LEADER,
                },
            });
            const id = iscr.json().registration.id;

            const res = await genera(god, id, 3, "2026-10-01T00:00:00.000Z");
            const importi = res.json().instalments.map((r: any) => r.amount);

            // Non 3.333 tre volte: un centesimo perso per rata è il modo peggiore
            // in cui un conto può non tornare (`RB28`).
            expect(importi).toEqual([3_334, 3_333, 3_333]);
            expect(importi.reduce((t: number, a: number) => t + a, 0)).toBe(10_000);
        });

        it("il 31 gennaio più un mese è FINE FEBBRAIO, non il 3 marzo", async () => {
            const god = await login(app, "god", "god");
            const id = await iscrittoCon180(god);

            // È il difetto che si vede solo a gennaio, cioè quando è tardi:
            // `setMonth` trabocca perché il 31 febbraio non esiste.
            const res = await genera(god, id, 3, "2027-01-31T00:00:00.000Z");
            const giorni = res.json().instalments.map((r: any) => {
                const d = new Date(r.dueAt);
                return [d.getMonth(), d.getDate()];
            });

            expect(giorni[0]).toEqual([0, 31]);   // 31 gennaio
            expect(giorni[1]).toEqual([1, 28]);   // 28 febbraio — non 3 marzo
            expect(giorni[2]).toEqual([2, 31]);   // 31 marzo
        });

        it("sostituisce il piano precedente invece di affiancarsene uno", async () => {
            const god = await login(app, "god", "god");
            const id = await iscrittoCon180(god);
            await scrivi(god, id, [{ amount: 9_000, dueAt: fra(5) }]);

            const res = await genera(god, id, 2, "2026-10-01T00:00:00.000Z");
            expect(res.json().instalments).toHaveLength(2);
        });

        it("una rata sola è legittima: «pagherà tutto il 1° di ottobre»", async () => {
            const god = await login(app, "god", "god");
            const id = await iscrittoCon180(god);

            const res = await genera(god, id, 1, "2026-10-01T00:00:00.000Z");
            expect(res.statusCode).toBe(200);
            expect(res.json().instalments).toHaveLength(1);
            expect(res.json().instalments[0].amount).toBe(9_000);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Il filtro «in ritardo» sulla lista iscritti
    // ═════════════════════════════════════════════════════════════════════════

    describe("Il filtro di chi è indietro", () => {
        function inRitardo(god: string) {
            return app.inject({
                method: "POST",
                url: "/api/registrations/",
                headers: { authorization: god },
                payload: {
                    query: { overdueOnly: true },
                    options: { limit: 100, page: 1, populate: "" },
                },
            });
        }

        it("trova chi ha rate scadute e scoperte, e non gli altri", async () => {
            const god = await login(app, "god", "god");

            // A: due rate scadute, nulla versato → in ritardo.
            const indietro = await iscrittoCon180(god);
            await scrivi(god, indietro, [
                { amount: 3_000, dueAt: fa(30) },
                { amount: 3_000, dueAt: fa(2) },
                { amount: 3_000, dueAt: fra(28) },
            ]);

            // B: stesse rate, ma le ha versate → in pari.
            const inPari = await iscrittoCon180(god);
            await scrivi(god, inPari, [
                { amount: 3_000, dueAt: fa(30) },
                { amount: 3_000, dueAt: fa(2) },
                { amount: 3_000, dueAt: fra(28) },
            ]);
            await incassa(god, inPari, 6_000);

            // C: nessun piano → non è in ritardo, perché non c'era una scadenza.
            const senzaPiano = await iscrittoCon180(god);

            const ids = (await inRitardo(god)).json().docs.map((d: any) => d.id);
            expect(ids).toContain(indietro);
            expect(ids).not.toContain(inPari);
            expect(ids).not.toContain(senzaPiano);
        });

        it("una rata che scade DOMANI non mette in ritardo", async () => {
            const god = await login(app, "god", "god");
            const id = await iscrittoCon180(god);
            await scrivi(god, id, [
                { amount: 9_000, dueAt: fra(1) },
            ]);

            const ids = (await inRitardo(god)).json().docs.map((d: any) => d.id);
            expect(ids).not.toContain(id);
        });
    });
});
