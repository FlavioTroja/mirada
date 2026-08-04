import { z } from 'zod';
import { CheckInKindSchema } from '../inputTypeSchemas/CheckInKindSchema'
import { TicketWithRelationsSchema, TicketPartialWithRelationsSchema, TicketOptionalDefaultsWithRelationsSchema } from './TicketSchema'
import type { TicketWithRelations, TicketPartialWithRelations, TicketOptionalDefaultsWithRelations } from './TicketSchema'
import { SessionWithRelationsSchema, SessionPartialWithRelationsSchema, SessionOptionalDefaultsWithRelationsSchema } from './SessionSchema'
import type { SessionWithRelations, SessionPartialWithRelations, SessionOptionalDefaultsWithRelations } from './SessionSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// CHECK IN SCHEMA
/////////////////////////////////////////

/**
 * L'accesso a **una singola sessione**, registrato sulla coppia
 * biglietto–sessione (`09` §7).
 * 
 * ── `RB7` ────────────────────────────────────────────────────────────────────
 * Indice unico **parziale** su `(ticketId, sessionId)` quando `revokedAt` è
 * nullo: *un QR vale una sola volta per sessione*. Prisma non sa esprimere un
 * indice parziale, quindi `@@unique` qui sotto è ricreato a mano nella
 * migrazione con la clausola `WHERE`.
 * 
 * ── `RB19` ───────────────────────────────────────────────────────────────────
 * **Il check-in non consuma capienza.** Le quote governano l'ammissione, il
 * contatore presenze governa la sicurezza: sono due assi distinti e questo
 * modello non ha alcuna relazione con `CapacityQuota`.
 * 
 * ── `RF-CHK-6` ───────────────────────────────────────────────────────────────
 * `conflictWithId` punta all'ingresso già registrato quando la sincronizzazione
 * della coda offline rileva un doppio ingresso. La seconda riga **viene creata e
 * lasciata allo staff**: i doppi ingressi sono conflitti da risolvere, mai
 * risolti in silenzio.
 */
export const CheckInSchema = z.object({
  kind: CheckInKindSchema,
  id: z.number().int(),
  ticketId: z.number().int(),
  sessionId: z.number().int(),
  registrationId: z.number().int(),
  operatorUserId: z.number().int(),
  /**
   * Momento della scansione **sul dispositivo**: offline può precedere di ore
   * la sincronizzazione, ed è questo il momento che vale come ingresso.
   */
  scannedAt: z.coerce.date(),
  /**
   * Momento in cui la riga è arrivata al server. Nullo sugli ingressi online.
   */
  syncedAt: z.coerce.date().nullish(),
  /**
   * La «postazione» che `RF-CHK-4` chiede di nominare su `ALREADY_USED`.
   */
  deviceId: z.string(),
  offline: z.boolean(),
  conflictWithId: z.number().int().nullish(),
  /**
   * Annullamento di un check-in errato (`RF-CHK-9`). Una riga revocata esce
   * dall'indice parziale: il biglietto può rientrare in quella sessione.
   */
  revokedAt: z.coerce.date().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type CheckIn = z.infer<typeof CheckInSchema>

/////////////////////////////////////////
// CHECK IN PARTIAL SCHEMA
/////////////////////////////////////////

export const CheckInPartialSchema = CheckInSchema.partial()

export type CheckInPartial = z.infer<typeof CheckInPartialSchema>

/////////////////////////////////////////
// CHECK IN OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const CheckInOptionalDefaultsSchema = CheckInSchema.merge(z.object({
  kind: CheckInKindSchema.optional(),
  id: z.number().int().optional(),
  /**
   * Momento della scansione **sul dispositivo**: offline può precedere di ore
   * la sincronizzazione, ed è questo il momento che vale come ingresso.
   */
  scannedAt: z.coerce.date().optional(),
  offline: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type CheckInOptionalDefaults = z.infer<typeof CheckInOptionalDefaultsSchema>

/////////////////////////////////////////
// CHECK IN RELATION SCHEMA
/////////////////////////////////////////

export type CheckInRelations = {
  ticket: TicketWithRelations;
  session: SessionWithRelations;
  registration: RegistrationWithRelations;
  operator: UserWithRelations;
  conflictWith?: CheckInWithRelations | null;
  conflicts: CheckInWithRelations[];
};

export type CheckInWithRelations = z.infer<typeof CheckInSchema> & CheckInRelations

export const CheckInWithRelationsSchema: z.ZodType<CheckInWithRelations> = CheckInSchema.merge(z.object({
  ticket: z.lazy(() => TicketWithRelationsSchema),
  session: z.lazy(() => SessionWithRelationsSchema),
  registration: z.lazy(() => RegistrationWithRelationsSchema),
  operator: z.lazy(() => UserWithRelationsSchema),
  conflictWith: z.lazy(() => CheckInWithRelationsSchema).nullish(),
  conflicts: z.lazy(() => CheckInWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// CHECK IN OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type CheckInOptionalDefaultsRelations = {
  ticket: TicketOptionalDefaultsWithRelations;
  session: SessionOptionalDefaultsWithRelations;
  registration: RegistrationOptionalDefaultsWithRelations;
  operator: UserOptionalDefaultsWithRelations;
  conflictWith?: CheckInOptionalDefaultsWithRelations | null;
  conflicts: CheckInOptionalDefaultsWithRelations[];
};

export type CheckInOptionalDefaultsWithRelations = z.infer<typeof CheckInOptionalDefaultsSchema> & CheckInOptionalDefaultsRelations

export const CheckInOptionalDefaultsWithRelationsSchema: z.ZodType<CheckInOptionalDefaultsWithRelations> = CheckInOptionalDefaultsSchema.merge(z.object({
  ticket: z.lazy(() => TicketOptionalDefaultsWithRelationsSchema),
  session: z.lazy(() => SessionOptionalDefaultsWithRelationsSchema),
  registration: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema),
  operator: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
  conflictWith: z.lazy(() => CheckInOptionalDefaultsWithRelationsSchema).nullish(),
  conflicts: z.lazy(() => CheckInOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// CHECK IN PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type CheckInPartialRelations = {
  ticket?: TicketPartialWithRelations;
  session?: SessionPartialWithRelations;
  registration?: RegistrationPartialWithRelations;
  operator?: UserPartialWithRelations;
  conflictWith?: CheckInPartialWithRelations | null;
  conflicts?: CheckInPartialWithRelations[];
};

export type CheckInPartialWithRelations = z.infer<typeof CheckInPartialSchema> & CheckInPartialRelations

export const CheckInPartialWithRelationsSchema: z.ZodType<CheckInPartialWithRelations> = CheckInPartialSchema.merge(z.object({
  ticket: z.lazy(() => TicketPartialWithRelationsSchema),
  session: z.lazy(() => SessionPartialWithRelationsSchema),
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
  operator: z.lazy(() => UserPartialWithRelationsSchema),
  conflictWith: z.lazy(() => CheckInPartialWithRelationsSchema).nullish(),
  conflicts: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
})).partial()

export type CheckInOptionalDefaultsWithPartialRelations = z.infer<typeof CheckInOptionalDefaultsSchema> & CheckInPartialRelations

export const CheckInOptionalDefaultsWithPartialRelationsSchema: z.ZodType<CheckInOptionalDefaultsWithPartialRelations> = CheckInOptionalDefaultsSchema.merge(z.object({
  ticket: z.lazy(() => TicketPartialWithRelationsSchema),
  session: z.lazy(() => SessionPartialWithRelationsSchema),
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
  operator: z.lazy(() => UserPartialWithRelationsSchema),
  conflictWith: z.lazy(() => CheckInPartialWithRelationsSchema).nullish(),
  conflicts: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
}).partial())

export type CheckInWithPartialRelations = z.infer<typeof CheckInSchema> & CheckInPartialRelations

export const CheckInWithPartialRelationsSchema: z.ZodType<CheckInWithPartialRelations> = CheckInSchema.merge(z.object({
  ticket: z.lazy(() => TicketPartialWithRelationsSchema),
  session: z.lazy(() => SessionPartialWithRelationsSchema),
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
  operator: z.lazy(() => UserPartialWithRelationsSchema),
  conflictWith: z.lazy(() => CheckInPartialWithRelationsSchema).nullish(),
  conflicts: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
}).partial())

export default CheckInSchema;
