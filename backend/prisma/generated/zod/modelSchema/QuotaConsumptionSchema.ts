import { z } from 'zod';
import { CapacityQuotaWithRelationsSchema, CapacityQuotaPartialWithRelationsSchema, CapacityQuotaOptionalDefaultsWithRelationsSchema } from './CapacityQuotaSchema'
import type { CapacityQuotaWithRelations, CapacityQuotaPartialWithRelations, CapacityQuotaOptionalDefaultsWithRelations } from './CapacityQuotaSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'

/////////////////////////////////////////
// QUOTA CONSUMPTION SCHEMA
/////////////////////////////////////////

/**
 * Il registro di ciò che ogni iscrizione occupa. È l'elemento che rende il
 * RILASCIO ESATTO anziché ricostruito: si leggono queste righe, si decrementano
 * esattamente quei contatori, si cancellano le righe (`05` §8).
 * 
 * La chiave unica `(capacityQuotaId, registrationId)` è ciò che rende l'impegno
 * IDEMPOTENTE sulla doppia notifica del prestatore di pagamento (§4.8 nota 3).
 */
export const QuotaConsumptionSchema = z.object({
  id: z.number().int(),
  capacityQuotaId: z.number().int(),
  registrationId: z.number().int(),
  quantity: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type QuotaConsumption = z.infer<typeof QuotaConsumptionSchema>

/////////////////////////////////////////
// QUOTA CONSUMPTION PARTIAL SCHEMA
/////////////////////////////////////////

export const QuotaConsumptionPartialSchema = QuotaConsumptionSchema.partial()

export type QuotaConsumptionPartial = z.infer<typeof QuotaConsumptionPartialSchema>

/////////////////////////////////////////
// QUOTA CONSUMPTION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const QuotaConsumptionOptionalDefaultsSchema = QuotaConsumptionSchema.merge(z.object({
  id: z.number().int().optional(),
  quantity: z.number().int().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type QuotaConsumptionOptionalDefaults = z.infer<typeof QuotaConsumptionOptionalDefaultsSchema>

/////////////////////////////////////////
// QUOTA CONSUMPTION RELATION SCHEMA
/////////////////////////////////////////

export type QuotaConsumptionRelations = {
  capacityQuota: CapacityQuotaWithRelations;
  registration: RegistrationWithRelations;
};

export type QuotaConsumptionWithRelations = z.infer<typeof QuotaConsumptionSchema> & QuotaConsumptionRelations

export const QuotaConsumptionWithRelationsSchema: z.ZodType<QuotaConsumptionWithRelations> = QuotaConsumptionSchema.merge(z.object({
  capacityQuota: z.lazy(() => CapacityQuotaWithRelationsSchema),
  registration: z.lazy(() => RegistrationWithRelationsSchema),
}))

/////////////////////////////////////////
// QUOTA CONSUMPTION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type QuotaConsumptionOptionalDefaultsRelations = {
  capacityQuota: CapacityQuotaOptionalDefaultsWithRelations;
  registration: RegistrationOptionalDefaultsWithRelations;
};

export type QuotaConsumptionOptionalDefaultsWithRelations = z.infer<typeof QuotaConsumptionOptionalDefaultsSchema> & QuotaConsumptionOptionalDefaultsRelations

export const QuotaConsumptionOptionalDefaultsWithRelationsSchema: z.ZodType<QuotaConsumptionOptionalDefaultsWithRelations> = QuotaConsumptionOptionalDefaultsSchema.merge(z.object({
  capacityQuota: z.lazy(() => CapacityQuotaOptionalDefaultsWithRelationsSchema),
  registration: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// QUOTA CONSUMPTION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type QuotaConsumptionPartialRelations = {
  capacityQuota?: CapacityQuotaPartialWithRelations;
  registration?: RegistrationPartialWithRelations;
};

export type QuotaConsumptionPartialWithRelations = z.infer<typeof QuotaConsumptionPartialSchema> & QuotaConsumptionPartialRelations

export const QuotaConsumptionPartialWithRelationsSchema: z.ZodType<QuotaConsumptionPartialWithRelations> = QuotaConsumptionPartialSchema.merge(z.object({
  capacityQuota: z.lazy(() => CapacityQuotaPartialWithRelationsSchema),
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
})).partial()

export type QuotaConsumptionOptionalDefaultsWithPartialRelations = z.infer<typeof QuotaConsumptionOptionalDefaultsSchema> & QuotaConsumptionPartialRelations

export const QuotaConsumptionOptionalDefaultsWithPartialRelationsSchema: z.ZodType<QuotaConsumptionOptionalDefaultsWithPartialRelations> = QuotaConsumptionOptionalDefaultsSchema.merge(z.object({
  capacityQuota: z.lazy(() => CapacityQuotaPartialWithRelationsSchema),
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
}).partial())

export type QuotaConsumptionWithPartialRelations = z.infer<typeof QuotaConsumptionSchema> & QuotaConsumptionPartialRelations

export const QuotaConsumptionWithPartialRelationsSchema: z.ZodType<QuotaConsumptionWithPartialRelations> = QuotaConsumptionSchema.merge(z.object({
  capacityQuota: z.lazy(() => CapacityQuotaPartialWithRelationsSchema),
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
}).partial())

export default QuotaConsumptionSchema;
