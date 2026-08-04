import { z } from "zod";
import { CheckInSchema } from "@prisma-gen/zod";

export const CheckInResponseSchema = CheckInSchema;
export type CheckInResponseDTO = z.infer<typeof CheckInResponseSchema>;

/**
 * `POST /check-ins/sync` → `{ accepted[], conflicts[] }` (§3.7, `RF-CHK-6`).
 *
 * ── Perché due elenchi e non un esito per voce ────────────────────────────────
 * Perché sono due cose diverse per chi guarda lo schermo: `accepted` si svuota
 * dalla coda e si dimentica, `conflicts` **apre un lavoro** in
 * `/check-in/conflicts`, dove staff vede i due ingressi con ora e postazione e
 * decide. I doppi ingressi **non sono mai risolti in silenzio**: nessuna libreria
 * lo fa di serie, ed è deliberato.
 */
export const CheckInSyncAcceptedSchema = z.object({
    localId: z.string().nullish(),
    checkIn: CheckInSchema,
    /** `true` quando la voce era già stata sincronizzata: stessa scansione, nessuna riga nuova. */
    duplicateOfSameScan: z.boolean(),
});
export type CheckInSyncAcceptedDTO = z.infer<typeof CheckInSyncAcceptedSchema>;

export const CheckInSyncConflictSchema = z.object({
    localId: z.string().nullish(),
    /** La riga **creata** con `conflictWithId` valorizzato e lasciata allo staff. */
    checkIn: CheckInSchema,
    /** L'ingresso già registrato, con la sua ora e la sua postazione. */
    conflictsWith: CheckInSchema,
    reason: z.literal("ALREADY_CHECKED_IN"),
});
export type CheckInSyncConflictDTO = z.infer<typeof CheckInSyncConflictSchema>;

export const CheckInSyncRejectedSchema = z.object({
    localId: z.string().nullish(),
    code: z.string().nullish(),
    ticketId: z.number().int().nullish(),
    sessionId: z.number().int(),
    reason: z.string(),
    message: z.string(),
});
export type CheckInSyncRejectedDTO = z.infer<typeof CheckInSyncRejectedSchema>;

export const CheckInSyncResultSchema = z.object({
    accepted: CheckInSyncAcceptedSchema.array(),
    conflicts: CheckInSyncConflictSchema.array(),
    /**
     * Voci che non hanno prodotto alcun ingresso: biglietto sconosciuto, evento
     * sbagliato, sessione non inclusa, biglietto annullato. Non sono conflitti da
     * dirimere, sono ingressi che non dovevano avvenire — e vanno tolti dalla
     * coda con il loro motivo, non ritentati all'infinito.
     */
    rejected: CheckInSyncRejectedSchema.array(),
});
export type CheckInSyncResultDTO = z.infer<typeof CheckInSyncResultSchema>;
