import { z } from 'zod';
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'

/////////////////////////////////////////
// COUPLE SCHEMA
/////////////////////////////////////////

/**
 * NON porta riferimenti alle due iscrizioni: sono le `Registration` a puntare
 * alla coppia con `coupleId`, così il grafo resta aciclico (§3.6).
 * Vincolo di servizio: esattamente due `Registration` con ruoli assegnati
 * complementari. `dissolve` NON muove alcun consumo — le persone restano,
 * cambia solo il legame (`05` §8).
 */
export const CoupleSchema = z.object({
  id: z.number().int(),
  eventId: z.number().int(),
  dissolvedAt: z.coerce.date().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Couple = z.infer<typeof CoupleSchema>

/////////////////////////////////////////
// COUPLE PARTIAL SCHEMA
/////////////////////////////////////////

export const CouplePartialSchema = CoupleSchema.partial()

export type CouplePartial = z.infer<typeof CouplePartialSchema>

/////////////////////////////////////////
// COUPLE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const CoupleOptionalDefaultsSchema = CoupleSchema.merge(z.object({
  id: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type CoupleOptionalDefaults = z.infer<typeof CoupleOptionalDefaultsSchema>

/////////////////////////////////////////
// COUPLE RELATION SCHEMA
/////////////////////////////////////////

export type CoupleRelations = {
  event: EventWithRelations;
  registrations: RegistrationWithRelations[];
};

export type CoupleWithRelations = z.infer<typeof CoupleSchema> & CoupleRelations

export const CoupleWithRelationsSchema: z.ZodType<CoupleWithRelations> = CoupleSchema.merge(z.object({
  event: z.lazy(() => EventWithRelationsSchema),
  registrations: z.lazy(() => RegistrationWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// COUPLE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type CoupleOptionalDefaultsRelations = {
  event: EventOptionalDefaultsWithRelations;
  registrations: RegistrationOptionalDefaultsWithRelations[];
};

export type CoupleOptionalDefaultsWithRelations = z.infer<typeof CoupleOptionalDefaultsSchema> & CoupleOptionalDefaultsRelations

export const CoupleOptionalDefaultsWithRelationsSchema: z.ZodType<CoupleOptionalDefaultsWithRelations> = CoupleOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  registrations: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// COUPLE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type CouplePartialRelations = {
  event?: EventPartialWithRelations;
  registrations?: RegistrationPartialWithRelations[];
};

export type CouplePartialWithRelations = z.infer<typeof CouplePartialSchema> & CouplePartialRelations

export const CouplePartialWithRelationsSchema: z.ZodType<CouplePartialWithRelations> = CouplePartialSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
})).partial()

export type CoupleOptionalDefaultsWithPartialRelations = z.infer<typeof CoupleOptionalDefaultsSchema> & CouplePartialRelations

export const CoupleOptionalDefaultsWithPartialRelationsSchema: z.ZodType<CoupleOptionalDefaultsWithPartialRelations> = CoupleOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
}).partial())

export type CoupleWithPartialRelations = z.infer<typeof CoupleSchema> & CouplePartialRelations

export const CoupleWithPartialRelationsSchema: z.ZodType<CoupleWithPartialRelations> = CoupleSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
}).partial())

export default CoupleSchema;
