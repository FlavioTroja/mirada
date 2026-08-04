import { z } from 'zod';
import { RoleNameSchema } from '../inputTypeSchemas/RoleNameSchema'
import { RoleWithRelationsSchema, RolePartialWithRelationsSchema, RoleOptionalDefaultsWithRelationsSchema } from './RoleSchema'
import type { RoleWithRelations, RolePartialWithRelations, RoleOptionalDefaultsWithRelations } from './RoleSchema'

/////////////////////////////////////////
// HIDDEN COMPONENT CONFIG SCHEMA
/////////////////////////////////////////

export const HiddenComponentConfigSchema = z.object({
  roleName: RoleNameSchema,
  id: z.number().int(),
  context: z.string(),
  section: z.string(),
  component: z.string(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type HiddenComponentConfig = z.infer<typeof HiddenComponentConfigSchema>

/////////////////////////////////////////
// HIDDEN COMPONENT CONFIG PARTIAL SCHEMA
/////////////////////////////////////////

export const HiddenComponentConfigPartialSchema = HiddenComponentConfigSchema.partial()

export type HiddenComponentConfigPartial = z.infer<typeof HiddenComponentConfigPartialSchema>

/////////////////////////////////////////
// HIDDEN COMPONENT CONFIG OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const HiddenComponentConfigOptionalDefaultsSchema = HiddenComponentConfigSchema.merge(z.object({
  id: z.number().int().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type HiddenComponentConfigOptionalDefaults = z.infer<typeof HiddenComponentConfigOptionalDefaultsSchema>

/////////////////////////////////////////
// HIDDEN COMPONENT CONFIG RELATION SCHEMA
/////////////////////////////////////////

export type HiddenComponentConfigRelations = {
  role: RoleWithRelations;
};

export type HiddenComponentConfigWithRelations = z.infer<typeof HiddenComponentConfigSchema> & HiddenComponentConfigRelations

export const HiddenComponentConfigWithRelationsSchema: z.ZodType<HiddenComponentConfigWithRelations> = HiddenComponentConfigSchema.merge(z.object({
  role: z.lazy(() => RoleWithRelationsSchema),
}))

/////////////////////////////////////////
// HIDDEN COMPONENT CONFIG OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type HiddenComponentConfigOptionalDefaultsRelations = {
  role: RoleOptionalDefaultsWithRelations;
};

export type HiddenComponentConfigOptionalDefaultsWithRelations = z.infer<typeof HiddenComponentConfigOptionalDefaultsSchema> & HiddenComponentConfigOptionalDefaultsRelations

export const HiddenComponentConfigOptionalDefaultsWithRelationsSchema: z.ZodType<HiddenComponentConfigOptionalDefaultsWithRelations> = HiddenComponentConfigOptionalDefaultsSchema.merge(z.object({
  role: z.lazy(() => RoleOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// HIDDEN COMPONENT CONFIG PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type HiddenComponentConfigPartialRelations = {
  role?: RolePartialWithRelations;
};

export type HiddenComponentConfigPartialWithRelations = z.infer<typeof HiddenComponentConfigPartialSchema> & HiddenComponentConfigPartialRelations

export const HiddenComponentConfigPartialWithRelationsSchema: z.ZodType<HiddenComponentConfigPartialWithRelations> = HiddenComponentConfigPartialSchema.merge(z.object({
  role: z.lazy(() => RolePartialWithRelationsSchema),
})).partial()

export type HiddenComponentConfigOptionalDefaultsWithPartialRelations = z.infer<typeof HiddenComponentConfigOptionalDefaultsSchema> & HiddenComponentConfigPartialRelations

export const HiddenComponentConfigOptionalDefaultsWithPartialRelationsSchema: z.ZodType<HiddenComponentConfigOptionalDefaultsWithPartialRelations> = HiddenComponentConfigOptionalDefaultsSchema.merge(z.object({
  role: z.lazy(() => RolePartialWithRelationsSchema),
}).partial())

export type HiddenComponentConfigWithPartialRelations = z.infer<typeof HiddenComponentConfigSchema> & HiddenComponentConfigPartialRelations

export const HiddenComponentConfigWithPartialRelationsSchema: z.ZodType<HiddenComponentConfigWithPartialRelations> = HiddenComponentConfigSchema.merge(z.object({
  role: z.lazy(() => RolePartialWithRelationsSchema),
}).partial())

export default HiddenComponentConfigSchema;
