import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { RequirementKindSchema } from '../inputTypeSchemas/RequirementKindSchema'
import { EventRequirementWithRelationsSchema, EventRequirementPartialWithRelationsSchema, EventRequirementOptionalDefaultsWithRelationsSchema } from './EventRequirementSchema'
import type { EventRequirementWithRelations, EventRequirementPartialWithRelations, EventRequirementOptionalDefaultsWithRelations } from './EventRequirementSchema'

/////////////////////////////////////////
// REQUIREMENT TYPE SCHEMA
/////////////////////////////////////////

export const RequirementTypeSchema = z.object({
  kind: RequirementKindSchema,
  id: z.number().int(),
  /**
   * I18nText { it, en? }
   */
  name: JsonValueSchema,
  configSchema: JsonValueSchema,
  active: z.boolean(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type RequirementType = z.infer<typeof RequirementTypeSchema>

/////////////////////////////////////////
// REQUIREMENT TYPE PARTIAL SCHEMA
/////////////////////////////////////////

export const RequirementTypePartialSchema = RequirementTypeSchema.partial()

export type RequirementTypePartial = z.infer<typeof RequirementTypePartialSchema>

/////////////////////////////////////////
// REQUIREMENT TYPE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const RequirementTypeOptionalDefaultsSchema = RequirementTypeSchema.merge(z.object({
  id: z.number().int().optional(),
  configSchema: JsonValueSchema,
  active: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type RequirementTypeOptionalDefaults = z.infer<typeof RequirementTypeOptionalDefaultsSchema>

/////////////////////////////////////////
// REQUIREMENT TYPE RELATION SCHEMA
/////////////////////////////////////////

export type RequirementTypeRelations = {
  eventRequirements: EventRequirementWithRelations[];
};

export type RequirementTypeWithRelations = z.infer<typeof RequirementTypeSchema> & RequirementTypeRelations

export const RequirementTypeWithRelationsSchema: z.ZodType<RequirementTypeWithRelations> = RequirementTypeSchema.merge(z.object({
  eventRequirements: z.lazy(() => EventRequirementWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// REQUIREMENT TYPE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type RequirementTypeOptionalDefaultsRelations = {
  eventRequirements: EventRequirementOptionalDefaultsWithRelations[];
};

export type RequirementTypeOptionalDefaultsWithRelations = z.infer<typeof RequirementTypeOptionalDefaultsSchema> & RequirementTypeOptionalDefaultsRelations

export const RequirementTypeOptionalDefaultsWithRelationsSchema: z.ZodType<RequirementTypeOptionalDefaultsWithRelations> = RequirementTypeOptionalDefaultsSchema.merge(z.object({
  eventRequirements: z.lazy(() => EventRequirementOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// REQUIREMENT TYPE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type RequirementTypePartialRelations = {
  eventRequirements?: EventRequirementPartialWithRelations[];
};

export type RequirementTypePartialWithRelations = z.infer<typeof RequirementTypePartialSchema> & RequirementTypePartialRelations

export const RequirementTypePartialWithRelationsSchema: z.ZodType<RequirementTypePartialWithRelations> = RequirementTypePartialSchema.merge(z.object({
  eventRequirements: z.lazy(() => EventRequirementPartialWithRelationsSchema).array(),
})).partial()

export type RequirementTypeOptionalDefaultsWithPartialRelations = z.infer<typeof RequirementTypeOptionalDefaultsSchema> & RequirementTypePartialRelations

export const RequirementTypeOptionalDefaultsWithPartialRelationsSchema: z.ZodType<RequirementTypeOptionalDefaultsWithPartialRelations> = RequirementTypeOptionalDefaultsSchema.merge(z.object({
  eventRequirements: z.lazy(() => EventRequirementPartialWithRelationsSchema).array(),
}).partial())

export type RequirementTypeWithPartialRelations = z.infer<typeof RequirementTypeSchema> & RequirementTypePartialRelations

export const RequirementTypeWithPartialRelationsSchema: z.ZodType<RequirementTypeWithPartialRelations> = RequirementTypeSchema.merge(z.object({
  eventRequirements: z.lazy(() => EventRequirementPartialWithRelationsSchema).array(),
}).partial())

export default RequirementTypeSchema;
