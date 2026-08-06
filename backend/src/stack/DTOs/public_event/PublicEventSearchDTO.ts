import { z } from "zod";
import { DanceRoleSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

/**
 * `POST /api/public/events/` — **la ricerca pubblica** (backend-brief §3.7).
 *
 * Corpo `{ query, options }` del dialetto §3.3, **senza autenticazione**.
 * `query` è esattamente l'elenco chiuso del §3.7:
 * `{ value?, city?, province?, region?, country?, eventTypeId?, from?, to?, role? }`.
 *
 * ── I tre campi che non sono un filtro qualunque ─────────────────────────────
 *
 * 1. **`value` è full-text** su titolo, descrizione, nome della location **e nomi
 *    del cast**. Il cast è una relazione: la si attraversa con un `some` — un
 *    `EXISTS` correlato, una sola query — mai con un giro di `findMany` per
 *    evento.
 * 2. **`from`/`to` filtrano sulla SOVRAPPOSIZIONE** con l'intervallo
 *    `[startAt, endAt]` dell'evento, non sul solo `startAt`. Un festival di
 *    quattro settimane già iniziato deve comparire in una ricerca «questa
 *    settimana»: filtrare su `startAt` lo farebbe sparire proprio mentre è in
 *    corso, che è l'unico momento in cui qualcuno lo cerca davvero.
 * 3. **`role` restringe agli eventi che hanno ancora capienza PER QUEL RUOLO.**
 *    È la ricerca che un tanghero fa davvero (`RF-PUB-2`): un evento pieno di
 *    follower e aperto ai leader deve comparire a un leader e non a una
 *    follower. Si appoggia al motore di capienza, non a un conteggio inventato.
 */
export const PublicEventQuerySchema = z.object({
    /** Full-text su titolo, descrizione, nome della location e nomi del cast. */
    value: z.string().optional(),

    city: z.string().optional(),
    /** Sigla di provincia (`BT`, `RM`, …). */
    province: z.string().optional(),
    /** Regione **derivata e indicizzata** su `Address.region` (§3.4). */
    region: z.string().optional(),
    country: z.string().optional(),

    eventTypeId: z.coerce.number().int().optional(),

    /** Estremi della finestra cercata: si confrontano con l'INTERVALLO dell'evento. */
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),

    /** Ruolo di ballo di chi cerca: restringe a ciò che ha ancora capienza per lui. */
    role: DanceRoleSchema.optional(),
});
export type PublicEventQueryDTO = z.infer<typeof PublicEventQuerySchema>;

export const PublicEventSearchSchema = paginateSchema(PublicEventQuerySchema);
export type PublicEventSearchDTO = z.infer<typeof PublicEventSearchSchema>;
