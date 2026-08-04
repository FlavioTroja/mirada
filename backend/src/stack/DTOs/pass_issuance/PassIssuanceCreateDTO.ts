import { z } from "zod";
import { DanceRoleSchema, PassIssuanceOptionalDefaultsSchema, PassIssuanceReasonSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * §4.12 — `issuedByUserId`, `issuedAt` e `revokedAt` **non compaiono**: chi ha
 * emesso e quando è la traccia dell'atto, non un dato che il client dichiari su
 * di sé.
 */
export const PassIssuanceCreateSchema = withoutMetadata(PassIssuanceOptionalDefaultsSchema)
    .omit({
        issuedByUserId: true,
        issuedAt: true,
        revokedAt: true,
    });

export type PassIssuanceCreateDTO = z.infer<typeof PassIssuanceCreateSchema>;

/** Nominativo di un pass nominale. Nessun contatto oltre l'email del titolare (`RB12`). */
export const PassHolderSchema = z.object({
    name: z.string().min(1),
    surname: z.string().min(1),
    email: z.string().email().nullish(),
});
export type PassHolderDTO = z.infer<typeof PassHolderSchema>;

/**
 * `POST /events/:id/pass-issuances/bulk` (§3.7, `RF-TCK-14`, `RB20`).
 *
 * ── Le tre regole che il servizio fa rispettare, e perché ────────────────────
 *
 * 1. **L'emissione non è mai bloccata dalle quote.** Si registra il consumo, si
 *    restituisce un **avviso** se si supera la capienza della sala, e si
 *    procede. La responsabilità della sala è dell'organizzatore: un blocco qui
 *    trasformerebbe uno strumento di servizio in un ostacolo la sera dell'evento.
 * 2. **Se l'evento usa quote per ruolo, `role` è obbligatorio** (`RF-TCK-15`).
 *    Senza, l'equilibrio leader/follower mostrato all'organizzatore diventa
 *    falso proprio dove serve — su un encuentro con tolleranza è la differenza
 *    fra una serata equilibrata e una sala con venti leader in più.
 * 3. **I pass in blocco senza nominativo sono al portatore**, `bearer = true`, e
 *    **non trasferibili**: non c'è un titolare da cui trasferire.
 */
export const PassIssuanceBulkSchema = z.object({
    ticketTypeId: z.number().int(),
    quantity: z.number().int().min(1).max(500),
    reason: PassIssuanceReasonSchema,
    role: DanceRoleSchema.nullish(),
    /** `true` = un nominativo per pass; `false` = pass al portatore. */
    nominal: z.boolean().default(false),
    note: z.string().nullish(),
    /** Obbligatorio e lungo esattamente `quantity` quando `nominal` è vero. */
    holders: PassHolderSchema.array().optional(),
});
export type PassIssuanceBulkDTO = z.infer<typeof PassIssuanceBulkSchema>;
