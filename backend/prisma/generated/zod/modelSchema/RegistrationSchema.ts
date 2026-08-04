import { z } from 'zod';
import { DeclaredDanceRoleSchema } from '../inputTypeSchemas/DeclaredDanceRoleSchema'
import { DanceRoleSchema } from '../inputTypeSchemas/DanceRoleSchema'
import { RegistrationChannelSchema } from '../inputTypeSchemas/RegistrationChannelSchema'
import { RegistrationStatusSchema } from '../inputTypeSchemas/RegistrationStatusSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'
import { CoupleWithRelationsSchema, CouplePartialWithRelationsSchema, CoupleOptionalDefaultsWithRelationsSchema } from './CoupleSchema'
import type { CoupleWithRelations, CouplePartialWithRelations, CoupleOptionalDefaultsWithRelations } from './CoupleSchema'
import { QuotaConsumptionWithRelationsSchema, QuotaConsumptionPartialWithRelationsSchema, QuotaConsumptionOptionalDefaultsWithRelationsSchema } from './QuotaConsumptionSchema'
import type { QuotaConsumptionWithRelations, QuotaConsumptionPartialWithRelations, QuotaConsumptionOptionalDefaultsWithRelations } from './QuotaConsumptionSchema'

/////////////////////////////////////////
// REGISTRATION SCHEMA
/////////////////////////////////////////

/**
 * Una iscrizione per persona per evento, con più biglietti collegati.
 * `assignedRole` è CALCOLATO DAL SERVER (§5): il DTO `Update` non lo accetta,
 * la riassegnazione passa dal servizio che rilascia i consumi del vecchio ruolo
 * e impegna quelli del nuovo con le stesse verifiche di un acquisto.
 */
export const RegistrationSchema = z.object({
  /**
   * Ciò che l'utente ha scelto.
   */
  declaredRole: DeclaredDanceRoleSchema,
  /**
   * Il ruolo effettivo, risolto alla conferma del pagamento. Mai nullo su
   * eventi con quote di ruolo (`05` §2.3, invariante I4).
   */
  assignedRole: DanceRoleSchema.nullish(),
  channel: RegistrationChannelSchema,
  status: RegistrationStatusSchema,
  id: z.number().int(),
  eventId: z.number().int(),
  personUserId: z.number().int().nullish(),
  holderName: z.string(),
  holderSurname: z.string(),
  holderEmail: z.string(),
  confirmedAt: z.coerce.date().nullish(),
  declinedAt: z.coerce.date().nullish(),
  coupleId: z.number().int().nullish(),
  isMinor: z.boolean(),
  guardianUserId: z.number().int().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Registration = z.infer<typeof RegistrationSchema>

/////////////////////////////////////////
// REGISTRATION PARTIAL SCHEMA
/////////////////////////////////////////

export const RegistrationPartialSchema = RegistrationSchema.partial()

export type RegistrationPartial = z.infer<typeof RegistrationPartialSchema>

/////////////////////////////////////////
// REGISTRATION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const RegistrationOptionalDefaultsSchema = RegistrationSchema.merge(z.object({
  channel: RegistrationChannelSchema.optional(),
  status: RegistrationStatusSchema.optional(),
  id: z.number().int().optional(),
  isMinor: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type RegistrationOptionalDefaults = z.infer<typeof RegistrationOptionalDefaultsSchema>

/////////////////////////////////////////
// REGISTRATION RELATION SCHEMA
/////////////////////////////////////////

export type RegistrationRelations = {
  event: EventWithRelations;
  personUser?: UserWithRelations | null;
  couple?: CoupleWithRelations | null;
  guardian?: UserWithRelations | null;
  quotaConsumptions: QuotaConsumptionWithRelations[];
};

export type RegistrationWithRelations = z.infer<typeof RegistrationSchema> & RegistrationRelations

export const RegistrationWithRelationsSchema: z.ZodType<RegistrationWithRelations> = RegistrationSchema.merge(z.object({
  event: z.lazy(() => EventWithRelationsSchema),
  personUser: z.lazy(() => UserWithRelationsSchema).nullish(),
  couple: z.lazy(() => CoupleWithRelationsSchema).nullish(),
  guardian: z.lazy(() => UserWithRelationsSchema).nullish(),
  quotaConsumptions: z.lazy(() => QuotaConsumptionWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// REGISTRATION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type RegistrationOptionalDefaultsRelations = {
  event: EventOptionalDefaultsWithRelations;
  personUser?: UserOptionalDefaultsWithRelations | null;
  couple?: CoupleOptionalDefaultsWithRelations | null;
  guardian?: UserOptionalDefaultsWithRelations | null;
  quotaConsumptions: QuotaConsumptionOptionalDefaultsWithRelations[];
};

export type RegistrationOptionalDefaultsWithRelations = z.infer<typeof RegistrationOptionalDefaultsSchema> & RegistrationOptionalDefaultsRelations

export const RegistrationOptionalDefaultsWithRelationsSchema: z.ZodType<RegistrationOptionalDefaultsWithRelations> = RegistrationOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  personUser: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullish(),
  couple: z.lazy(() => CoupleOptionalDefaultsWithRelationsSchema).nullish(),
  guardian: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullish(),
  quotaConsumptions: z.lazy(() => QuotaConsumptionOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// REGISTRATION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type RegistrationPartialRelations = {
  event?: EventPartialWithRelations;
  personUser?: UserPartialWithRelations | null;
  couple?: CouplePartialWithRelations | null;
  guardian?: UserPartialWithRelations | null;
  quotaConsumptions?: QuotaConsumptionPartialWithRelations[];
};

export type RegistrationPartialWithRelations = z.infer<typeof RegistrationPartialSchema> & RegistrationPartialRelations

export const RegistrationPartialWithRelationsSchema: z.ZodType<RegistrationPartialWithRelations> = RegistrationPartialSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  personUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  couple: z.lazy(() => CouplePartialWithRelationsSchema).nullish(),
  guardian: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  quotaConsumptions: z.lazy(() => QuotaConsumptionPartialWithRelationsSchema).array(),
})).partial()

export type RegistrationOptionalDefaultsWithPartialRelations = z.infer<typeof RegistrationOptionalDefaultsSchema> & RegistrationPartialRelations

export const RegistrationOptionalDefaultsWithPartialRelationsSchema: z.ZodType<RegistrationOptionalDefaultsWithPartialRelations> = RegistrationOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  personUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  couple: z.lazy(() => CouplePartialWithRelationsSchema).nullish(),
  guardian: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  quotaConsumptions: z.lazy(() => QuotaConsumptionPartialWithRelationsSchema).array(),
}).partial())

export type RegistrationWithPartialRelations = z.infer<typeof RegistrationSchema> & RegistrationPartialRelations

export const RegistrationWithPartialRelationsSchema: z.ZodType<RegistrationWithPartialRelations> = RegistrationSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  personUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  couple: z.lazy(() => CouplePartialWithRelationsSchema).nullish(),
  guardian: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  quotaConsumptions: z.lazy(() => QuotaConsumptionPartialWithRelationsSchema).array(),
}).partial())

export default RegistrationSchema;
