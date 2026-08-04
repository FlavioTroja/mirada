import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { EventServiceWithRelationsSchema, EventServicePartialWithRelationsSchema, EventServiceOptionalDefaultsWithRelationsSchema } from './EventServiceSchema'
import type { EventServiceWithRelations, EventServicePartialWithRelations, EventServiceOptionalDefaultsWithRelations } from './EventServiceSchema'

/////////////////////////////////////////
// SERVICE TYPE SCHEMA
/////////////////////////////////////////

export const ServiceTypeSchema = z.object({
  id: z.number().int(),
  /**
   * I18nText { it, en? }
   */
  name: JsonValueSchema,
  attributesSchema: JsonValueSchema,
  active: z.boolean(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type ServiceType = z.infer<typeof ServiceTypeSchema>

/////////////////////////////////////////
// SERVICE TYPE PARTIAL SCHEMA
/////////////////////////////////////////

export const ServiceTypePartialSchema = ServiceTypeSchema.partial()

export type ServiceTypePartial = z.infer<typeof ServiceTypePartialSchema>

/////////////////////////////////////////
// SERVICE TYPE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const ServiceTypeOptionalDefaultsSchema = ServiceTypeSchema.merge(z.object({
  id: z.number().int().optional(),
  attributesSchema: JsonValueSchema,
  active: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type ServiceTypeOptionalDefaults = z.infer<typeof ServiceTypeOptionalDefaultsSchema>

/////////////////////////////////////////
// SERVICE TYPE RELATION SCHEMA
/////////////////////////////////////////

export type ServiceTypeRelations = {
  eventServices: EventServiceWithRelations[];
};

export type ServiceTypeWithRelations = z.infer<typeof ServiceTypeSchema> & ServiceTypeRelations

export const ServiceTypeWithRelationsSchema: z.ZodType<ServiceTypeWithRelations> = ServiceTypeSchema.merge(z.object({
  eventServices: z.lazy(() => EventServiceWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// SERVICE TYPE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type ServiceTypeOptionalDefaultsRelations = {
  eventServices: EventServiceOptionalDefaultsWithRelations[];
};

export type ServiceTypeOptionalDefaultsWithRelations = z.infer<typeof ServiceTypeOptionalDefaultsSchema> & ServiceTypeOptionalDefaultsRelations

export const ServiceTypeOptionalDefaultsWithRelationsSchema: z.ZodType<ServiceTypeOptionalDefaultsWithRelations> = ServiceTypeOptionalDefaultsSchema.merge(z.object({
  eventServices: z.lazy(() => EventServiceOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// SERVICE TYPE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type ServiceTypePartialRelations = {
  eventServices?: EventServicePartialWithRelations[];
};

export type ServiceTypePartialWithRelations = z.infer<typeof ServiceTypePartialSchema> & ServiceTypePartialRelations

export const ServiceTypePartialWithRelationsSchema: z.ZodType<ServiceTypePartialWithRelations> = ServiceTypePartialSchema.merge(z.object({
  eventServices: z.lazy(() => EventServicePartialWithRelationsSchema).array(),
})).partial()

export type ServiceTypeOptionalDefaultsWithPartialRelations = z.infer<typeof ServiceTypeOptionalDefaultsSchema> & ServiceTypePartialRelations

export const ServiceTypeOptionalDefaultsWithPartialRelationsSchema: z.ZodType<ServiceTypeOptionalDefaultsWithPartialRelations> = ServiceTypeOptionalDefaultsSchema.merge(z.object({
  eventServices: z.lazy(() => EventServicePartialWithRelationsSchema).array(),
}).partial())

export type ServiceTypeWithPartialRelations = z.infer<typeof ServiceTypeSchema> & ServiceTypePartialRelations

export const ServiceTypeWithPartialRelationsSchema: z.ZodType<ServiceTypeWithPartialRelations> = ServiceTypeSchema.merge(z.object({
  eventServices: z.lazy(() => EventServicePartialWithRelationsSchema).array(),
}).partial())

export default ServiceTypeSchema;
