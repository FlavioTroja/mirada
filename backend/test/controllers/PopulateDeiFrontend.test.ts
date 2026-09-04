import { login } from "../helpers";

const app = (globalThis as any).__TEST_APP__;

/**
 * **Ogni rotta di lista, con la stringa di `populate` che il back-office manda
 * davvero.**
 *
 * ── Perché questa suite esiste ───────────────────────────────────────────────
 * Il 4 settembre 2026 la migrazione che ha sostituito `Registration.personUserId`
 * con `personId` ha rinominato anche la relazione. `RegistrationStore` continuava
 * a chiedere `populate=personUser`, Prisma rifiuta una relazione che non esiste,
 * e **l'intera lista iscritti rispondeva 500**. Il difetto è arrivato in
 * produzione perché:
 *
 *  - il TypeScript dei due progetti è separato — nessun tipo lega la stringa di
 *    populate del front-office alle relazioni dello schema;
 *  - `tsc` era pulito, la build passava, 217 prove erano verdi;
 *  - nessuna prova guardava **quella rotta** con **quella stringa**.
 *
 * È la famiglia di trappole che `CLAUDE.md` elenca: qualcosa che nel repository
 * esiste e in esercizio non c'è, senza che nulla fallisca.
 *
 * ── Come si tiene allineata ─────────────────────────────────────────────────
 * La tabella qui sotto è copiata da `listPopulate` degli store di `app/`. Quando
 * uno store cambia populate, questa riga va cambiata con lui — ed è il punto:
 * la divergenza diventa **una prova rossa** invece di un 500 in produzione.
 *
 * ⚠️ Non verifica che il dato serva a qualcosa: verifica che la relazione
 * ESISTA. È esattamente ciò che mancava.
 */
describe("Il populate che i frontend mandano davvero", () => {
    /** `[rotta, populate]` — copiati da `app/src/app/stores/*.store.ts`. */
    const ROTTE: Array<[string, string]> = [
        ["addresses", ""],
        ["artists", "photoFile"],
        ["balance-settlements", ""],
        ["capacity-quotas", ""],
        ["couples", "registrations"],
        ["event-casts", "artist artist.photoFile"],
        ["event-requirements", "requirementType"],
        ["event-services", "serviceType"],
        ["events", "eventType venue organization posterVerticalFile"],
        ["event-types", ""],
        ["fiscal-declarations", "declaredBy event"],
        ["organization-members", "user"],
        ["organizations", "address logoFile"],
        ["refund-policies", "derivedFromPolicy"],
        ["registrations", "couple person person.user person.user.logoFile"],
        ["requirement-types", ""],
        ["sales-channels", "mappings depositCodes"],
        ["service-types", ""],
        ["sessions", ""],
        ["ticket-types", ""],
        ["venues", "address"],
    ];

    it.each(ROTTE)("POST /%s risponde con populate '%s'", async (rotta, populate) => {
        const god = await login(app, "god", "god");

        const res = await app.inject({
            method: "POST",
            url: `/api/${rotta}/`,
            headers: { authorization: god },
            payload: { query: {}, options: { limit: 5, page: 1, populate } },
        });

        // Un 500 qui significa quasi sempre una relazione rinominata nello schema
        // e non aggiornata nello store del front-office. Il corpo dell'errore
        // nomina la relazione: leggerlo è il modo più veloce per capire quale.
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.json().docs)).toBe(true);
    });
    /**
     * `detailPopulate` — le stringhe della **scheda**, che sono altre.
     *
     * Si provano contro la stessa rotta di lista: ciò che si verifica è che le
     * relazioni ESISTANO, e `getPopulateOptions` è lo stesso codice sui due
     * percorsi. Così non serve un id da cui partire, e la prova resta stabile.
     */
    const DETTAGLI: Array<[string, string]> = [
        ["artists", "photoFile"],
        ["couples", "registrations"],
        ["event-casts", "artist artist.photoFile"],
        ["event-requirements", "requirementType"],
        ["event-services", "serviceType"],
        ["events", "eventType venue organization posterVerticalFile posterHorizontalFile posterSquareFile"],
        ["fiscal-declarations", "declaredBy event organization"],
        ["organization-members", "user organization"],
        ["organizations", "address logoFile"],
        ["refund-policies", "derivedFromPolicy"],
        ["registrations", "couple event quotaConsumptions"],
        ["sales-channels", "mappings depositCodes"],
        ["ticket-types", "sessions priceTiers"],
        ["venues", "address"],
    ];

    it.each(DETTAGLI)("la scheda di /%s risponde con populate '%s'", async (rotta, populate) => {
        const god = await login(app, "god", "god");

        const res = await app.inject({
            method: "POST",
            url: `/api/${rotta}/`,
            headers: { authorization: god },
            payload: { query: {}, options: { limit: 5, page: 1, populate } },
        });

        expect(res.statusCode).toBe(200);
    });
});
