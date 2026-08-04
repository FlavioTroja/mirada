import { z } from 'zod';
import { RoleNameSchema } from '../inputTypeSchemas/RoleNameSchema'
import { RoleToUserWithRelationsSchema, RoleToUserPartialWithRelationsSchema, RoleToUserOptionalDefaultsWithRelationsSchema } from './RoleToUserSchema'
import type { RoleToUserWithRelations, RoleToUserPartialWithRelations, RoleToUserOptionalDefaultsWithRelations } from './RoleToUserSchema'
import { PermissionConfigWithRelationsSchema, PermissionConfigPartialWithRelationsSchema, PermissionConfigOptionalDefaultsWithRelationsSchema } from './PermissionConfigSchema'
import type { PermissionConfigWithRelations, PermissionConfigPartialWithRelations, PermissionConfigOptionalDefaultsWithRelations } from './PermissionConfigSchema'
import { HiddenComponentConfigWithRelationsSchema, HiddenComponentConfigPartialWithRelationsSchema, HiddenComponentConfigOptionalDefaultsWithRelationsSchema } from './HiddenComponentConfigSchema'
import type { HiddenComponentConfigWithRelations, HiddenComponentConfigPartialWithRelations, HiddenComponentConfigOptionalDefaultsWithRelations } from './HiddenComponentConfigSchema'

/////////////////////////////////////////
// ROLE SCHEMA
/////////////////////////////////////////

export const RoleSchema = z.object({
  name: RoleNameSchema,
  label: z.string().nullish(),
  rank: z.number(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Role = z.infer<typeof RoleSchema>

/////////////////////////////////////////
// ROLE PARTIAL SCHEMA
/////////////////////////////////////////

export const RolePartialSchema = RoleSchema.partial()

export type RolePartial = z.infer<typeof RolePartialSchema>

/////////////////////////////////////////
// ROLE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const RoleOptionalDefaultsSchema = RoleSchema.merge(z.object({
  isActive: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type RoleOptionalDefaults = z.infer<typeof RoleOptionalDefaultsSchema>

/////////////////////////////////////////
// ROLE RELATION SCHEMA
/////////////////////////////////////////

export type RoleRelations = {
  users: RoleToUserWithRelations[];
  permissionConfigs: PermissionConfigWithRelations[];
  hiddenComponentConfigs: HiddenComponentConfigWithRelations[];
};

export type RoleWithRelations = z.infer<typeof RoleSchema> & RoleRelations

export const RoleWithRelationsSchema: z.ZodType<RoleWithRelations> = RoleSchema.merge(z.object({
  users: z.lazy(() => RoleToUserWithRelationsSchema).array(),
  permissionConfigs: z.lazy(() => PermissionConfigWithRelationsSchema).array(),
  hiddenComponentConfigs: z.lazy(() => HiddenComponentConfigWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ROLE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type RoleOptionalDefaultsRelations = {
  users: RoleToUserOptionalDefaultsWithRelations[];
  permissionConfigs: PermissionConfigOptionalDefaultsWithRelations[];
  hiddenComponentConfigs: HiddenComponentConfigOptionalDefaultsWithRelations[];
};

export type RoleOptionalDefaultsWithRelations = z.infer<typeof RoleOptionalDefaultsSchema> & RoleOptionalDefaultsRelations

export const RoleOptionalDefaultsWithRelationsSchema: z.ZodType<RoleOptionalDefaultsWithRelations> = RoleOptionalDefaultsSchema.merge(z.object({
  users: z.lazy(() => RoleToUserOptionalDefaultsWithRelationsSchema).array(),
  permissionConfigs: z.lazy(() => PermissionConfigOptionalDefaultsWithRelationsSchema).array(),
  hiddenComponentConfigs: z.lazy(() => HiddenComponentConfigOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ROLE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type RolePartialRelations = {
  users?: RoleToUserPartialWithRelations[];
  permissionConfigs?: PermissionConfigPartialWithRelations[];
  hiddenComponentConfigs?: HiddenComponentConfigPartialWithRelations[];
};

export type RolePartialWithRelations = z.infer<typeof RolePartialSchema> & RolePartialRelations

export const RolePartialWithRelationsSchema: z.ZodType<RolePartialWithRelations> = RolePartialSchema.merge(z.object({
  users: z.lazy(() => RoleToUserPartialWithRelationsSchema).array(),
  permissionConfigs: z.lazy(() => PermissionConfigPartialWithRelationsSchema).array(),
  hiddenComponentConfigs: z.lazy(() => HiddenComponentConfigPartialWithRelationsSchema).array(),
})).partial()

export type RoleOptionalDefaultsWithPartialRelations = z.infer<typeof RoleOptionalDefaultsSchema> & RolePartialRelations

export const RoleOptionalDefaultsWithPartialRelationsSchema: z.ZodType<RoleOptionalDefaultsWithPartialRelations> = RoleOptionalDefaultsSchema.merge(z.object({
  users: z.lazy(() => RoleToUserPartialWithRelationsSchema).array(),
  permissionConfigs: z.lazy(() => PermissionConfigPartialWithRelationsSchema).array(),
  hiddenComponentConfigs: z.lazy(() => HiddenComponentConfigPartialWithRelationsSchema).array(),
}).partial())

export type RoleWithPartialRelations = z.infer<typeof RoleSchema> & RolePartialRelations

export const RoleWithPartialRelationsSchema: z.ZodType<RoleWithPartialRelations> = RoleSchema.merge(z.object({
  users: z.lazy(() => RoleToUserPartialWithRelationsSchema).array(),
  permissionConfigs: z.lazy(() => PermissionConfigPartialWithRelationsSchema).array(),
  hiddenComponentConfigs: z.lazy(() => HiddenComponentConfigPartialWithRelationsSchema).array(),
}).partial())

export default RoleSchema;
