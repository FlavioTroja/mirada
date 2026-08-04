import { z } from 'zod';
import { RoleNameSchema } from '../inputTypeSchemas/RoleNameSchema'
import { RoleWithRelationsSchema, RolePartialWithRelationsSchema, RoleOptionalDefaultsWithRelationsSchema } from './RoleSchema'
import type { RoleWithRelations, RolePartialWithRelations, RoleOptionalDefaultsWithRelations } from './RoleSchema'

/////////////////////////////////////////
// PERMISSION CONFIG SCHEMA
/////////////////////////////////////////

export const PermissionConfigSchema = z.object({
  roleName: RoleNameSchema,
  id: z.number().int(),
  action: z.string(),
  entity: z.string(),
  scope: z.string(),
})

export type PermissionConfig = z.infer<typeof PermissionConfigSchema>

/////////////////////////////////////////
// PERMISSION CONFIG PARTIAL SCHEMA
/////////////////////////////////////////

export const PermissionConfigPartialSchema = PermissionConfigSchema.partial()

export type PermissionConfigPartial = z.infer<typeof PermissionConfigPartialSchema>

/////////////////////////////////////////
// PERMISSION CONFIG OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PermissionConfigOptionalDefaultsSchema = PermissionConfigSchema.merge(z.object({
  id: z.number().int().optional(),
}))

export type PermissionConfigOptionalDefaults = z.infer<typeof PermissionConfigOptionalDefaultsSchema>

/////////////////////////////////////////
// PERMISSION CONFIG RELATION SCHEMA
/////////////////////////////////////////

export type PermissionConfigRelations = {
  role: RoleWithRelations;
};

export type PermissionConfigWithRelations = z.infer<typeof PermissionConfigSchema> & PermissionConfigRelations

export const PermissionConfigWithRelationsSchema: z.ZodType<PermissionConfigWithRelations> = PermissionConfigSchema.merge(z.object({
  role: z.lazy(() => RoleWithRelationsSchema),
}))

/////////////////////////////////////////
// PERMISSION CONFIG OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PermissionConfigOptionalDefaultsRelations = {
  role: RoleOptionalDefaultsWithRelations;
};

export type PermissionConfigOptionalDefaultsWithRelations = z.infer<typeof PermissionConfigOptionalDefaultsSchema> & PermissionConfigOptionalDefaultsRelations

export const PermissionConfigOptionalDefaultsWithRelationsSchema: z.ZodType<PermissionConfigOptionalDefaultsWithRelations> = PermissionConfigOptionalDefaultsSchema.merge(z.object({
  role: z.lazy(() => RoleOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// PERMISSION CONFIG PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PermissionConfigPartialRelations = {
  role?: RolePartialWithRelations;
};

export type PermissionConfigPartialWithRelations = z.infer<typeof PermissionConfigPartialSchema> & PermissionConfigPartialRelations

export const PermissionConfigPartialWithRelationsSchema: z.ZodType<PermissionConfigPartialWithRelations> = PermissionConfigPartialSchema.merge(z.object({
  role: z.lazy(() => RolePartialWithRelationsSchema),
})).partial()

export type PermissionConfigOptionalDefaultsWithPartialRelations = z.infer<typeof PermissionConfigOptionalDefaultsSchema> & PermissionConfigPartialRelations

export const PermissionConfigOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PermissionConfigOptionalDefaultsWithPartialRelations> = PermissionConfigOptionalDefaultsSchema.merge(z.object({
  role: z.lazy(() => RolePartialWithRelationsSchema),
}).partial())

export type PermissionConfigWithPartialRelations = z.infer<typeof PermissionConfigSchema> & PermissionConfigPartialRelations

export const PermissionConfigWithPartialRelationsSchema: z.ZodType<PermissionConfigWithPartialRelations> = PermissionConfigSchema.merge(z.object({
  role: z.lazy(() => RolePartialWithRelationsSchema),
}).partial())

export default PermissionConfigSchema;
