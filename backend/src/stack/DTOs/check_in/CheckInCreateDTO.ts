import { z } from "zod";
import { CheckInKindSchema, CheckInOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/**
 * `POST /check-ins/create` — l'ingresso registrato **online**, con rete.
 *
 * `operatorUserId` **non compare**: è chi sta scansionando, e lo sa il token, non
 * il corpo della richiesta. `syncedAt` e `conflictWithId` nemmeno: appartengono
 * alla sincronizzazione della coda offline (`POST /check-ins/sync`), che è
 * l'unico percorso autorizzato a creare una riga di conflitto (`RF-CHK-6`).
 *
 * `registrationId` è facoltativo perché il biglietto lo conosce già: si accetta
 * per le voci di coda che lo portano con sé, e si deriva quando manca.
 */
export const CheckInCreateSchema = withoutMetadata(CheckInOptionalDefaultsSchema)
    .omit({
        operatorUserId: true,
        syncedAt: true,
        conflictWithId: true,
        revokedAt: true,
        registrationId: true,
    })
    .extend({
        registrationId: z.number().int().nullish(),
    });

export type CheckInCreateDTO = z.infer<typeof CheckInCreateSchema>;

/**
 * Una voce della coda locale — `POST /check-ins/sync` body `{ entries[] }`.
 *
 * Il biglietto si indica con il **codice** letto dal QR (che offline è tutto ciò
 * che il dispositivo ha) oppure con l'id, se la lista scaricata lo portava.
 * `localId` è l'identificativo che la coda usa su IndexedDB: torna identico in
 * `accepted` e in `conflicts`, ed è ciò che consente di svuotare la coda senza
 * indovinare quale voce sia stata accettata.
 */
export const CheckInSyncEntrySchema = z.object({
    localId: z.string().nullish(),
    ticketId: z.number().int().nullish(),
    code: z.string().nullish(),
    sessionId: z.number().int(),
    kind: CheckInKindSchema.optional(),
    /** L'istante della scansione **sul dispositivo**: è questo che vale come ingresso. */
    scannedAt: z.coerce.date(),
    deviceId: z.string().min(1),
});
export type CheckInSyncEntryDTO = z.infer<typeof CheckInSyncEntrySchema>;

export const CheckInSyncSchema = z.object({
    entries: CheckInSyncEntrySchema.array().max(1000),
});
export type CheckInSyncDTO = z.infer<typeof CheckInSyncSchema>;
