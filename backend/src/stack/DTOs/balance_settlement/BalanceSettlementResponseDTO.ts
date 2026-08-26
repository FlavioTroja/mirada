import { z } from "zod";
import { BalanceSettlementSchema } from "@prisma-gen/zod";

export const BalanceSettlementResponseSchema = BalanceSettlementSchema;
export type BalanceSettlementResponseDTO = z.infer<typeof BalanceSettlementResponseSchema>;

/**
 * `POST /balance-settlements/sync` → `{ accepted[], conflicts[] }` — la coda
 * della cassa che torna a casa (`RF-SAL-11`).
 *
 * Stessa forma della coda del check-in, e per la stessa ragione: `accepted` si
 * svuota dalla coda e si dimentica, `conflicts` **apre un lavoro** che qualcuno
 * deve guardare. La differenza è che qui il lavoro riguarda del denaro contato,
 * quindi la riga in conflitto esiste comunque — cancellarla perché il server
 * preferisce il primo arrivato significherebbe far quadrare i conti sul telefono
 * e non nella cassa.
 */
export const BalanceSettlementSyncAcceptedSchema = z.object({
    deviceReference: z.string(),
    settlement: BalanceSettlementSchema,
    /** `true` quando la voce era già stata sincronizzata: stesso riferimento, nessuna riga nuova. */
    duplicateOfSameEntry: z.boolean(),
});
export type BalanceSettlementSyncAcceptedDTO = z.infer<typeof BalanceSettlementSyncAcceptedSchema>;

export const BalanceSettlementSyncConflictSchema = z.object({
    deviceReference: z.string(),
    /** La riga **creata** con `conflictWithId` valorizzato e lasciata allo staff. */
    settlement: BalanceSettlementSchema,
    /** L'incasso che c'era già, con la sua ora e la sua postazione. `null` quando il residuo era zero. */
    conflictsWith: BalanceSettlementSchema.nullable(),
    reason: z.enum(["ALREADY_SETTLED", "EXCEEDS_BALANCE", "NO_BALANCE_DUE"]),
});
export type BalanceSettlementSyncConflictDTO = z.infer<typeof BalanceSettlementSyncConflictSchema>;

export const BalanceSettlementSyncRejectedSchema = z.object({
    deviceReference: z.string(),
    registrationId: z.number().int(),
    reason: z.string(),
    message: z.string(),
});
export type BalanceSettlementSyncRejectedDTO = z.infer<typeof BalanceSettlementSyncRejectedSchema>;

export const BalanceSettlementSyncResultSchema = z.object({
    accepted: BalanceSettlementSyncAcceptedSchema.array(),
    conflicts: BalanceSettlementSyncConflictSchema.array(),
    rejected: BalanceSettlementSyncRejectedSchema.array(),
});
export type BalanceSettlementSyncResultDTO = z.infer<typeof BalanceSettlementSyncResultSchema>;
