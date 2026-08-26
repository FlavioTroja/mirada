import { z } from 'zod';
import { BalanceSettlementMethodSchema } from '../inputTypeSchemas/BalanceSettlementMethodSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// BALANCE SETTLEMENT SCHEMA
/////////////////////////////////////////

/**
 * Il registro dei saldi incassati (`14` §6, `RF-SAL-8`).
 * 
 * ── Perché ogni incasso è una riga ─────────────────────────────────────────
 * Senza le righe, la chiusura di cassa e i totali all'organizzatore non hanno
 * da dove uscire, e «chi ha in tasca cosa» a fine serata è un'opinione. La
 * chiusura per operatore e per turno è fuori dal primo taglio, ma le righe ci
 * sono tutte fin da subito: si costruirà senza migrare nulla.
 * 
 * ── Si registra, non si contabilizza (`RB26`) ──────────────────────────────
 * Queste righe non compaiono fra i `Payment` né nei rendiconti degli incassi
 * Mirada. Gli adempimenti fiscali su quel contante — ricevuta, corrispettivi —
 * restano dell'organizzatore, come già oggi per l'incasso sul negozio.
 */
export const BalanceSettlementSchema = z.object({
  method: BalanceSettlementMethodSchema,
  id: z.number().int(),
  registrationId: z.number().int(),
  /**
   * Centesimi interi. Positivo: una restituzione non è un incasso negativo, ed
   * è dichiarata fuori dal taglio finché non esiste la ricevuta che la regge.
   */
  amount: z.number().int(),
  operatorUserId: z.number().int(),
  /**
   * Momento della riscossione **sul dispositivo** — offline può precedere di
   * ore la sincronizzazione, ed è questo il momento in cui il denaro è passato
   * di mano. Stessa scelta di `CheckIn.scannedAt`, e per la stessa ragione.
   */
  collectedAt: z.coerce.date(),
  /**
   * Momento in cui la riga è arrivata al server. Nullo sugli incassi online.
   */
  syncedAt: z.coerce.date().nullish(),
  /**
   * La postazione. **Nullo sul saldo anticipato dal back-office** (`RF-SAL-10`),
   * che è una riga come le altre ma non nasce a una porta.
   */
  deviceId: z.string().nullish(),
  offline: z.boolean(),
  /**
   * Il riferimento generato dal dispositivo, unico per postazione: è ciò che
   * rende la **stessa** riga sincronizzata due volte una riga sola.
   * 
   * ⚠️ L'unicità è su `(deviceId, deviceReference)` e qui i `NULL` distinti di
   * PostgreSQL sono **voluti**, al contrario di `SalesChannelMapping`: le righe
   * del back-office non hanno né postazione né riferimento, e devono poter
   * essere molte — una persona può saldare in due bonifici.
   */
  deviceReference: z.string().nullish(),
  /**
   * Il **doppio incasso**: due postazioni scollegate possono incassare due
   * volte lo stesso residuo senza saperlo. Si tratta come il doppio ingresso di
   * `RF-CHK-6` — la seconda riga **viene creata**, marcata qui, e lasciata allo
   * staff. Mai scartata in silenzio: sono soldi che qualcuno ha realmente preso
   * in mano, e cancellarli perché il server preferisce il primo arrivato
   * significherebbe far quadrare i conti sul telefono e non nella cassa.
   */
  conflictWithId: z.number().int().nullish(),
  /**
   * Quello che l'operatore vuole lasciare scritto — «pagato in due banconote da
   * 50 e contestava la cifra». Serve a chi risolve il conflitto domani.
   */
  note: z.string().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type BalanceSettlement = z.infer<typeof BalanceSettlementSchema>

/////////////////////////////////////////
// BALANCE SETTLEMENT PARTIAL SCHEMA
/////////////////////////////////////////

export const BalanceSettlementPartialSchema = BalanceSettlementSchema.partial()

export type BalanceSettlementPartial = z.infer<typeof BalanceSettlementPartialSchema>

/////////////////////////////////////////
// BALANCE SETTLEMENT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const BalanceSettlementOptionalDefaultsSchema = BalanceSettlementSchema.merge(z.object({
  id: z.number().int().optional(),
  /**
   * Momento della riscossione **sul dispositivo** — offline può precedere di
   * ore la sincronizzazione, ed è questo il momento in cui il denaro è passato
   * di mano. Stessa scelta di `CheckIn.scannedAt`, e per la stessa ragione.
   */
  collectedAt: z.coerce.date().optional(),
  offline: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type BalanceSettlementOptionalDefaults = z.infer<typeof BalanceSettlementOptionalDefaultsSchema>

/////////////////////////////////////////
// BALANCE SETTLEMENT RELATION SCHEMA
/////////////////////////////////////////

export type BalanceSettlementRelations = {
  registration: RegistrationWithRelations;
  operator: UserWithRelations;
  conflictWith?: BalanceSettlementWithRelations | null;
  conflicts: BalanceSettlementWithRelations[];
};

export type BalanceSettlementWithRelations = z.infer<typeof BalanceSettlementSchema> & BalanceSettlementRelations

export const BalanceSettlementWithRelationsSchema: z.ZodType<BalanceSettlementWithRelations> = BalanceSettlementSchema.merge(z.object({
  registration: z.lazy(() => RegistrationWithRelationsSchema),
  operator: z.lazy(() => UserWithRelationsSchema),
  conflictWith: z.lazy(() => BalanceSettlementWithRelationsSchema).nullish(),
  conflicts: z.lazy(() => BalanceSettlementWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// BALANCE SETTLEMENT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type BalanceSettlementOptionalDefaultsRelations = {
  registration: RegistrationOptionalDefaultsWithRelations;
  operator: UserOptionalDefaultsWithRelations;
  conflictWith?: BalanceSettlementOptionalDefaultsWithRelations | null;
  conflicts: BalanceSettlementOptionalDefaultsWithRelations[];
};

export type BalanceSettlementOptionalDefaultsWithRelations = z.infer<typeof BalanceSettlementOptionalDefaultsSchema> & BalanceSettlementOptionalDefaultsRelations

export const BalanceSettlementOptionalDefaultsWithRelationsSchema: z.ZodType<BalanceSettlementOptionalDefaultsWithRelations> = BalanceSettlementOptionalDefaultsSchema.merge(z.object({
  registration: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema),
  operator: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
  conflictWith: z.lazy(() => BalanceSettlementOptionalDefaultsWithRelationsSchema).nullish(),
  conflicts: z.lazy(() => BalanceSettlementOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// BALANCE SETTLEMENT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type BalanceSettlementPartialRelations = {
  registration?: RegistrationPartialWithRelations;
  operator?: UserPartialWithRelations;
  conflictWith?: BalanceSettlementPartialWithRelations | null;
  conflicts?: BalanceSettlementPartialWithRelations[];
};

export type BalanceSettlementPartialWithRelations = z.infer<typeof BalanceSettlementPartialSchema> & BalanceSettlementPartialRelations

export const BalanceSettlementPartialWithRelationsSchema: z.ZodType<BalanceSettlementPartialWithRelations> = BalanceSettlementPartialSchema.merge(z.object({
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
  operator: z.lazy(() => UserPartialWithRelationsSchema),
  conflictWith: z.lazy(() => BalanceSettlementPartialWithRelationsSchema).nullish(),
  conflicts: z.lazy(() => BalanceSettlementPartialWithRelationsSchema).array(),
})).partial()

export type BalanceSettlementOptionalDefaultsWithPartialRelations = z.infer<typeof BalanceSettlementOptionalDefaultsSchema> & BalanceSettlementPartialRelations

export const BalanceSettlementOptionalDefaultsWithPartialRelationsSchema: z.ZodType<BalanceSettlementOptionalDefaultsWithPartialRelations> = BalanceSettlementOptionalDefaultsSchema.merge(z.object({
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
  operator: z.lazy(() => UserPartialWithRelationsSchema),
  conflictWith: z.lazy(() => BalanceSettlementPartialWithRelationsSchema).nullish(),
  conflicts: z.lazy(() => BalanceSettlementPartialWithRelationsSchema).array(),
}).partial())

export type BalanceSettlementWithPartialRelations = z.infer<typeof BalanceSettlementSchema> & BalanceSettlementPartialRelations

export const BalanceSettlementWithPartialRelationsSchema: z.ZodType<BalanceSettlementWithPartialRelations> = BalanceSettlementSchema.merge(z.object({
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
  operator: z.lazy(() => UserPartialWithRelationsSchema),
  conflictWith: z.lazy(() => BalanceSettlementPartialWithRelationsSchema).nullish(),
  conflicts: z.lazy(() => BalanceSettlementPartialWithRelationsSchema).array(),
}).partial())

export default BalanceSettlementSchema;
