import { EventTypeFamily } from "@prisma/client";
import { createEventScenario } from "../fixtures/capacity";

const app = (globalThis as any).__TEST_APP__;

/**
 * **I corsi non stanno sul sito pubblico** — decisione del 4 settembre 2026.
 *
 * Un corso è un `Event` come un festival (`15-corsi.md` §2.1) — stessa tabella,
 * stesso motore di capienza — e proprio per questo, senza un filtro esplicito,
 * comparirebbe nel calendario di `mirada.dance` insieme alle milonghe.
 *
 * Sarebbe una promessa rotta nel punto peggiore: al corso ci si iscrive in
 * segreteria e si paga con una spunta, non dal checkout. Una scheda pubblica
 * inviterebbe a comprare qualcosa che non è in vendita, e lo si scoprirebbe
 * provandoci.
 *
 * ⚠️ Il filtro è sulla **famiglia del tipo**, non sullo slug: il giorno in cui
 * nasce «Corso serale» deve restare fuori senza che nessuno tocchi questo test.
 */
describe("I corsi non compaiono nella ricerca pubblica", () => {
    /** Il dialetto `{ query, options }` del §3.3: entrambi obbligatori. */
    function cerca(query: Record<string, unknown> = {}) {
        return app.inject({
            method: "POST",
            url: "/api/public/events/",
            payload: { query, options: { limit: 100, page: 1, populate: "" } },
        });
    }

    it("un evento della famiglia EVENT compare", async () => {
        const scenario = await createEventScenario();

        const res = await cerca();
        expect(res.statusCode).toBe(200);
        const ids = (res.json().docs ?? []).map((d: { id: number }) => d.id);
        expect(ids).toContain(scenario.event.id);
    });

    it("un corso NON compare, pur essendo pubblicato e in vendita", async () => {
        // Stessa fixture, stesso stato PUBLISHED, stesse date future: l'unica
        // differenza è la famiglia del tipo. Se comparisse, il filtro non c'è.
        const corso = await createEventScenario({ family: EventTypeFamily.COURSE });

        const res = await cerca();
        expect(res.statusCode).toBe(200);
        const ids = (res.json().docs ?? []).map((d: { id: number }) => d.id);
        expect(ids).not.toContain(corso.event.id);
    });

    it("e non compare nemmeno cercandolo per nome", async () => {
        // Il percorso testuale passa da `findIdsMatchingText`, che è una query
        // diversa: un filtro applicato solo al ramo senza ricerca lascerebbe il
        // corso raggiungibile a chi ne conosce il titolo.
        const corso = await createEventScenario({ family: EventTypeFamily.COURSE });

        const res = await cerca({ value: "collaudo" });
        expect(res.statusCode).toBe(200);
        const ids = (res.json().docs ?? []).map((d: { id: number }) => d.id);
        expect(ids).not.toContain(corso.event.id);
    });
});
