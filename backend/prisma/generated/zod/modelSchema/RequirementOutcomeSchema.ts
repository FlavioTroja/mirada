import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { RequirementOutcomeStatusSchema } from '../inputTypeSchemas/RequirementOutcomeStatusSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'
import { EventRequirementWithRelationsSchema, EventRequirementPartialWithRelationsSchema, EventRequirementOptionalDefaultsWithRelationsSchema } from './EventRequirementSchema'
import type { EventRequirementWithRelations, EventRequirementPartialWithRelations, EventRequirementOptionalDefaultsWithRelations } from './EventRequirementSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// REQUIREMENT OUTCOME SCHEMA
/////////////////////////////////////////

/**
 * L'esito di un requisito d'evento su una singola iscrizione.
 * 
 * `acceptedAt`, `acceptedIp` e `acceptedVersion` sono **calcolati dal server**
 * (`RF-REQ-4`): sono la prova di quando e da dove la persona ha accettato, e un
 * client che li scrivesse renderebbe la prova inutile. Nessun DTO li accetta.
 * 
 * `value` porta il dato dichiarato (`DECLARATION`) o il campo personalizzato
 * (`CUSTOM_FIELD`). Nel primo taglio non esistono altri generi: nessun upload di
 * documenti, nessun dato sanitario, mai (`RF-REQ-2`, `RF-REQ-3`). Il contenuto
 * di `value` **non compare mai** nella vista di check-in (`RB12`).
 */
export const RequirementOutcomeSchema = z.object({
  status: RequirementOutcomeStatusSchema,
  id: z.number().int(),
  registrationId: z.number().int(),
  eventRequirementId: z.number().int(),
  value: JsonValueSchema,
  /**
   * Calcolati dal server (`RF-REQ-4`).
   */
  acceptedAt: z.coerce.date().nullish(),
  acceptedIp: z.string().nullish(),
  acceptedVersion: z.string().nullish(),
  reviewedByUserId: z.number().int().nullish(),
  reviewedAt: z.coerce.date().nullish(),
  rejectionReason: z.string().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type RequirementOutcome = z.infer<typeof RequirementOutcomeSchema>

/////////////////////////////////////////
// REQUIREMENT OUTCOME PARTIAL SCHEMA
/////////////////////////////////////////

export const RequirementOutcomePartialSchema = RequirementOutcomeSchema.partial()

export type RequirementOutcomePartial = z.infer<typeof RequirementOutcomePartialSchema>

/////////////////////////////////////////
// REQUIREMENT OUTCOME OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const RequirementOutcomeOptionalDefaultsSchema = RequirementOutcomeSchema.merge(z.object({
  status: RequirementOutcomeStatusSchema.optional(),
  id: z.number().int().optional(),
  value: JsonValueSchema,
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type RequirementOutcomeOptionalDefaults = z.infer<typeof RequirementOutcomeOptionalDefaultsSchema>

/////////////////////////////////////////
// REQUIREMENT OUTCOME RELATION SCHEMA
/////////////////////////////////////////

export type RequirementOutcomeRelations = {
  registration: RegistrationWithRelations;
  eventRequirement: EventRequirementWithRelations;
  reviewedBy?: UserWithRelations | null;
};

export type RequirementOutcomeWithRelations = z.infer<typeof RequirementOutcomeSchema> & RequirementOutcomeRelations

export const RequirementOutcomeWithRelationsSchema: z.ZodType<RequirementOutcomeWithRelations> = RequirementOutcomeSchema.merge(z.object({
  registration: z.lazy(() => RegistrationWithRelationsSchema),
  eventRequirement: z.lazy(() => EventRequirementWithRelationsSchema),
  reviewedBy: z.lazy(() => UserWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// REQUIREMENT OUTCOME OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type RequirementOutcomeOptionalDefaultsRelations = {
  registration: RegistrationOptionalDefaultsWithRelations;
  eventRequirement: EventRequirementOptionalDefaultsWithRelations;
  reviewedBy?: UserOptionalDefaultsWithRelations | null;
};

export type RequirementOutcomeOptionalDefaultsWithRelations = z.infer<typeof RequirementOutcomeOptionalDefaultsSchema> & RequirementOutcomeOptionalDefaultsRelations

export const RequirementOutcomeOptionalDefaultsWithRelationsSchema: z.ZodType<RequirementOutcomeOptionalDefaultsWithRelations> = RequirementOutcomeOptionalDefaultsSchema.merge(z.object({
  registration: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema),
  eventRequirement: z.lazy(() => EventRequirementOptionalDefaultsWithRelationsSchema),
  reviewedBy: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// REQUIREMENT OUTCOME PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type RequirementOutcomePartialRelations = {
  registration?: RegistrationPartialWithRelations;
  eventRequirement?: EventRequirementPartialWithRelations;
  reviewedBy?: UserPartialWithRelations | null;
};

export type RequirementOutcomePartialWithRelations = z.infer<typeof RequirementOutcomePartialSchema> & RequirementOutcomePartialRelations

export const RequirementOutcomePartialWithRelationsSchema: z.ZodType<RequirementOutcomePartialWithRelations> = RequirementOutcomePartialSchema.merge(z.object({
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
  eventRequirement: z.lazy(() => EventRequirementPartialWithRelationsSchema),
  reviewedBy: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
})).partial()

export type RequirementOutcomeOptionalDefaultsWithPartialRelations = z.infer<typeof RequirementOutcomeOptionalDefaultsSchema> & RequirementOutcomePartialRelations

export const RequirementOutcomeOptionalDefaultsWithPartialRelationsSchema: z.ZodType<RequirementOutcomeOptionalDefaultsWithPartialRelations> = RequirementOutcomeOptionalDefaultsSchema.merge(z.object({
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
  eventRequirement: z.lazy(() => EventRequirementPartialWithRelationsSchema),
  reviewedBy: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
}).partial())

export type RequirementOutcomeWithPartialRelations = z.infer<typeof RequirementOutcomeSchema> & RequirementOutcomePartialRelations

export const RequirementOutcomeWithPartialRelationsSchema: z.ZodType<RequirementOutcomeWithPartialRelations> = RequirementOutcomeSchema.merge(z.object({
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
  eventRequirement: z.lazy(() => EventRequirementPartialWithRelationsSchema),
  reviewedBy: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
}).partial())

export default RequirementOutcomeSchema;
