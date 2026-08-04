import { z } from "zod";
import { DanceRoleSchema, TicketStatusSchema } from "@prisma-gen/zod";

/**
 * `GET /events/:id/checkin-manifest` — **la lista firmata che l'operatore scarica
 * prima dell'evento** (§3.7, §4.13, `RF-CHK-2`, `RF-CHK-3`).
 *
 * ── Perché è firmata, e perché porta la chiave pubblica ──────────────────────
 * La verifica del QR deve funzionare **senza rete**: in sala non c'è campo, e il
 * dispositivo deve poter dire da solo se un QR è autentico. Con il manifest
 * viaggia quindi la **chiave pubblica Ed25519**, che finisce in IndexedDB
 * insieme alla lista. Il `keyId` esiste per la rotazione: un QR firmato con una
 * chiave che il manifest non porta è rifiutato, non verificato «per sicurezza»
 * con quella corrente.
 *
 * Il manifest è a sua volta firmato con la stessa chiave: una lista alterata sul
 * dispositivo è una lista che ammette chi non ha pagato.
 *
 * ── `RB12`, minimizzazione ───────────────────────────────────────────────────
 * Ogni voce porta **nominativo, ruolo, titolo, sessioni incluse, servizi**. Non
 * porta email, non porta il contenuto dei requisiti, non porta diete né
 * allergie. Dei requisiti bloccanti in ingresso si porta **il nome e lo stato**,
 * che è tutto ciò che serve per dire *«manca la liberatoria»* alla porta.
 */
export const CheckInManifestEntrySchema = z.object({
    ticketId: z.number().int(),
    /** Il codice che il QR contiene: è la chiave con cui la lista locale si interroga. */
    code: z.string(),
    status: TicketStatusSchema,
    bearer: z.boolean(),
    holderName: z.string(),
    holderSurname: z.string(),
    role: DanceRoleSchema.nullish(),
    registrationId: z.number().int().nullish(),
    ticketTypeId: z.number().int(),
    ticketTypeName: z.unknown(),
    sessionIds: z.number().int().array(),
    services: z.object({ id: z.number().int(), name: z.unknown() }).array(),
    /** Requisiti bloccanti in ingresso ancora non soddisfatti — solo il nome (`RB12`). */
    blockingRequirements: z
        .object({
            eventRequirementId: z.number().int(),
            label: z.unknown(),
            status: z.string().nullish(),
        })
        .array(),
});
export type CheckInManifestEntryDTO = z.infer<typeof CheckInManifestEntrySchema>;

export const CheckInManifestPayloadSchema = z.object({
    eventId: z.number().int(),
    eventSlug: z.string(),
    eventTitle: z.unknown(),
    generatedAt: z.coerce.date(),
    sessions: z
        .object({
            id: z.number().int(),
            name: z.unknown(),
            startAt: z.coerce.date(),
            endAt: z.coerce.date(),
            room: z.string().nullish(),
            isImplicit: z.boolean(),
            cancelledAt: z.coerce.date().nullish(),
        })
        .array(),
    /** I requisiti che bloccano **l'ingresso** (`blocking = ENTRY`), non l'acquisto. */
    blockingRequirements: z
        .object({
            id: z.number().int(),
            label: z.unknown(),
            mandatory: z.boolean(),
        })
        .array(),
    entries: CheckInManifestEntrySchema.array(),
});
export type CheckInManifestPayloadDTO = z.infer<typeof CheckInManifestPayloadSchema>;

export const CheckInManifestSchema = z.object({
    manifest: CheckInManifestPayloadSchema,
    /** Firma Ed25519 del manifest, in JWS compatto con payload staccato. */
    signature: z.object({
        algorithm: z.literal("Ed25519"),
        keyId: z.string(),
        /** JWS compatto sul digest canonico del manifest. */
        value: z.string(),
    }),
    /** La chiave con cui verificare **i QR** e il manifest stesso, offline. */
    publicKey: z.object({
        keyId: z.string(),
        algorithm: z.literal("Ed25519"),
        spki: z.string(),
        jwk: z.object({ kty: z.literal("OKP"), crv: z.literal("Ed25519"), x: z.string() }),
    }),
});
export type CheckInManifestDTO = z.infer<typeof CheckInManifestSchema>;
