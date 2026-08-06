import { z } from "zod";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/**
 * `PublicEventCard` — la scheda **di elenco** restituita da
 * `POST /api/public/events/` (backend-brief §3.7).
 *
 * Porta **il minimo per una card**, e il minimo è dichiarato dal §3.7: titolo,
 * slug, date, location con città/provincia/regione, tipo evento, locandina
 * verticale, **prezzo minimo fra i titoli pubblici** e **disponibilità
 * sintetica**.
 *
 * ── Perché una forma propria e non l'entità `Event` ──────────────────────────
 * La scheda completa è `GET /api/public/events/:slug` e costa sessioni, cast,
 * requisiti, servizi e policy. Restituire quella forma in un elenco paginato
 * significherebbe spedire dieci schede complete per mostrare dieci righe, in
 * SSR, sull'app `www`. La card è ciò che si disegna, non ciò che si possiede.
 *
 * ── `availability`, e perché è «sintetica» ───────────────────────────────────
 * Non è la proiezione di `POST /public/events/:id/availability`: quella è la
 * sorgente del polling della **scheda**, costa tre query e va per titolo. Qui
 * servono tre booleani e due residui, calcolati sulle quote di ambito `EVENT`
 * già caricate per il filtro `role` — **nessuna query in più per riga**.
 * `null` significa *nessuna quota configurata*, cioè **nessun vincolo**: non
 * zero, che significherebbe esaurito (`05` §4).
 */
export const PublicEventCardAvailabilitySchema = z.object({
    /** Almeno una quota limitante di ambito evento è satura: l'evento è chiuso per tutti. */
    soldOut: z.boolean(),
    /** Residuo sulla capienza della sala. `null` = nessuna quota configurata. */
    remaining: z.number().int().nullable(),
    roles: z.object({
        leader: z.number().int().nullable(),
        follower: z.number().int().nullable(),
    }),
    /** Blocco **temporaneo** per sbilancio: può sbloccarsi (`ROLE_ON_HOLD`, §3.3). */
    rolesOnHold: z.object({
        leader: z.boolean(),
        follower: z.boolean(),
    }),
});
export type PublicEventCardAvailabilityDTO = z.infer<typeof PublicEventCardAvailabilitySchema>;

export const PublicEventCardSchema = z.object({
    id: z.number().int(),
    slug: z.string(),
    /** Oggetto intero anche senza traduzione: è il frontend a dichiarare la lingua (`RF-PUB-10`). */
    title: I18nTextSchema,

    startAt: z.date(),
    endAt: z.date(),

    eventType: z.object({
        id: z.number().int(),
        slug: z.string(),
        name: I18nTextSchema,
    }),

    venue: z.object({
        id: z.number().int(),
        name: z.string(),
        city: z.string().nullable(),
        province: z.string().nullable(),
        /** Derivata dalla provincia, indicizzata (§3.4). */
        region: z.string().nullable(),
        country: z.string().nullable(),
    }),

    organization: z.object({
        id: z.number().int(),
        name: z.string(),
    }),

    /** Il ritaglio verticale è quello della scheda di elenco (`RF-EVT-3`). */
    posterVerticalUrl: z.string().nullable(),

    /**
     * Centesimi interi (§3.1). Prezzo **minimo fra i titoli pubblici**, valutato
     * sullo scaglione attivo di ciascuno con la stessa funzione del checkout —
     * `selectActiveTier` — perché il «da €» di un elenco e il prezzo bloccato in
     * carrello non possono divergere. `null` = nessun titolo pubblico in vendita.
     */
    priceFrom: z.number().int().nullable(),

    availability: PublicEventCardAvailabilitySchema,
});
export type PublicEventCardDTO = z.infer<typeof PublicEventCardSchema>;
