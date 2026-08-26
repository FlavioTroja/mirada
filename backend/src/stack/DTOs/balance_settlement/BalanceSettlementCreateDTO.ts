import { z } from "zod";
import { BalanceSettlementMethodSchema, BalanceSettlementOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * `POST /balance-settlements/create` — **un saldo incassato**, `14` §6.1.
 *
 * ── Che cosa NON si accetta dal corpo, e perché ─────────────────────────────
 * `operatorUserId` è chi sta incassando, e lo sa il gettone: accettarlo dal
 * corpo permetterebbe di intestare a un altro i soldi che si hanno in mano, che
 * è precisamente la firma di una cassa che non torna.
 *
 * `conflictWithId` lo decide il servizio (`RF-SAL-11`): un conflitto è un fatto
 * che il server accerta confrontando le righe, non un'etichetta che il
 * dispositivo si assegna da sé.
 *
 * `syncedAt` è il momento in cui la riga arriva al server, e il server lo sa già.
 */
export const BalanceSettlementCreateSchema = withoutMetadata(BalanceSettlementOptionalDefaultsSchema)
    .omit({
        operatorUserId: true,
        syncedAt: true,
        conflictWithId: true,
    })
    .extend({
        /** Centesimi interi, positivi. Una restituzione non è un incasso negativo. */
        amount: z.number().int().positive(),
        method: BalanceSettlementMethodSchema,
    });

export type BalanceSettlementCreateDTO = z.infer<typeof BalanceSettlementCreateSchema>;

/**
 * Una voce della coda locale — `POST /balance-settlements/sync`.
 *
 * `deviceReference` è generato dal dispositivo ed è unico per postazione: è ciò
 * che rende la stessa riscossione sincronizzata due volte **una riga sola**. Non
 * è facoltativo qui, al contrario che sull'incasso online: senza, una coda che
 * riprova dopo un timeout raddoppierebbe l'incasso.
 */
export const BalanceSettlementSyncEntrySchema = z.object({
    registrationId: z.number().int(),
    amount: z.number().int().positive(),
    method: BalanceSettlementMethodSchema,
    /** L'istante della riscossione **sul dispositivo**: è quando il denaro è passato di mano. */
    collectedAt: z.coerce.date(),
    deviceId: z.string().min(1),
    deviceReference: z.string().min(1),
    note: z.string().nullish(),
});
export type BalanceSettlementSyncEntryDTO = z.infer<typeof BalanceSettlementSyncEntrySchema>;

export const BalanceSettlementSyncSchema = z.object({
    entries: BalanceSettlementSyncEntrySchema.array().max(1000),
});
export type BalanceSettlementSyncDTO = z.infer<typeof BalanceSettlementSyncSchema>;
