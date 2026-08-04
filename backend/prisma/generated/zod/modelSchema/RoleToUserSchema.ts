import { z } from 'zod';
import { RoleNameSchema } from '../inputTypeSchemas/RoleNameSchema'
import { RoleWithRelationsSchema, RolePartialWithRelationsSchema, RoleOptionalDefaultsWithRelationsSchema } from './RoleSchema'
import type { RoleWithRelations, RolePartialWithRelations, RoleOptionalDefaultsWithRelations } from './RoleSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// ROLE TO USER SCHEMA
/////////////////////////////////////////

export const RoleToUserSchema = z.object({
  roleName: RoleNameSchema,
  id: z.number().int(),
  userId: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type RoleToUser = z.infer<typeof RoleToUserSchema>

/////////////////////////////////////////
// ROLE TO USER PARTIAL SCHEMA
/////////////////////////////////////////

export const RoleToUserPartialSchema = RoleToUserSchema.partial()

export type RoleToUserPartial = z.infer<typeof RoleToUserPartialSchema>

/////////////////////////////////////////
// ROLE TO USER OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const RoleToUserOptionalDefaultsSchema = RoleToUserSchema.merge(z.object({
  id: z.number().int().optional(),
  isActive: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type RoleToUserOptionalDefaults = z.infer<typeof RoleToUserOptionalDefaultsSchema>

/////////////////////////////////////////
// ROLE TO USER RELATION SCHEMA
/////////////////////////////////////////

export type RoleToUserRelations = {
  role: RoleWithRelations;
  user: UserWithRelations;
};

export type RoleToUserWithRelations = z.infer<typeof RoleToUserSchema> & RoleToUserRelations

export const RoleToUserWithRelationsSchema: z.ZodType<RoleToUserWithRelations> = RoleToUserSchema.merge(z.object({
  role: z.lazy(() => RoleWithRelationsSchema),
  user: z.lazy(() => UserWithRelationsSchema),
}))

/////////////////////////////////////////
// ROLE TO USER OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type RoleToUserOptionalDefaultsRelations = {
  role: RoleOptionalDefaultsWithRelations;
  user: UserOptionalDefaultsWithRelations;
};

export type RoleToUserOptionalDefaultsWithRelations = z.infer<typeof RoleToUserOptionalDefaultsSchema> & RoleToUserOptionalDefaultsRelations

export const RoleToUserOptionalDefaultsWithRelationsSchema: z.ZodType<RoleToUserOptionalDefaultsWithRelations> = RoleToUserOptionalDefaultsSchema.merge(z.object({
  role: z.lazy(() => RoleOptionalDefaultsWithRelationsSchema),
  user: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// ROLE TO USER PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type RoleToUserPartialRelations = {
  role?: RolePartialWithRelations;
  user?: UserPartialWithRelations;
};

export type RoleToUserPartialWithRelations = z.infer<typeof RoleToUserPartialSchema> & RoleToUserPartialRelations

export const RoleToUserPartialWithRelationsSchema: z.ZodType<RoleToUserPartialWithRelations> = RoleToUserPartialSchema.merge(z.object({
  role: z.lazy(() => RolePartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
})).partial()

export type RoleToUserOptionalDefaultsWithPartialRelations = z.infer<typeof RoleToUserOptionalDefaultsSchema> & RoleToUserPartialRelations

export const RoleToUserOptionalDefaultsWithPartialRelationsSchema: z.ZodType<RoleToUserOptionalDefaultsWithPartialRelations> = RoleToUserOptionalDefaultsSchema.merge(z.object({
  role: z.lazy(() => RolePartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export type RoleToUserWithPartialRelations = z.infer<typeof RoleToUserSchema> & RoleToUserPartialRelations

export const RoleToUserWithPartialRelationsSchema: z.ZodType<RoleToUserWithPartialRelations> = RoleToUserSchema.merge(z.object({
  role: z.lazy(() => RolePartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export default RoleToUserSchema;
