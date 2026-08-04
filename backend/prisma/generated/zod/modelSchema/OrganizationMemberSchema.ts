import { z } from 'zod';
import { OrgMemberRoleSchema } from '../inputTypeSchemas/OrgMemberRoleSchema'
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// ORGANIZATION MEMBER SCHEMA
/////////////////////////////////////////

export const OrganizationMemberSchema = z.object({
  role: OrgMemberRoleSchema,
  id: z.number().int(),
  organizationId: z.number().int(),
  userId: z.number().int(),
  invitedAt: z.coerce.date(),
  acceptedAt: z.coerce.date().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>

/////////////////////////////////////////
// ORGANIZATION MEMBER PARTIAL SCHEMA
/////////////////////////////////////////

export const OrganizationMemberPartialSchema = OrganizationMemberSchema.partial()

export type OrganizationMemberPartial = z.infer<typeof OrganizationMemberPartialSchema>

/////////////////////////////////////////
// ORGANIZATION MEMBER OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const OrganizationMemberOptionalDefaultsSchema = OrganizationMemberSchema.merge(z.object({
  id: z.number().int().optional(),
  invitedAt: z.coerce.date().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type OrganizationMemberOptionalDefaults = z.infer<typeof OrganizationMemberOptionalDefaultsSchema>

/////////////////////////////////////////
// ORGANIZATION MEMBER RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationMemberRelations = {
  organization: OrganizationWithRelations;
  user: UserWithRelations;
};

export type OrganizationMemberWithRelations = z.infer<typeof OrganizationMemberSchema> & OrganizationMemberRelations

export const OrganizationMemberWithRelationsSchema: z.ZodType<OrganizationMemberWithRelations> = OrganizationMemberSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  user: z.lazy(() => UserWithRelationsSchema),
}))

/////////////////////////////////////////
// ORGANIZATION MEMBER OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationMemberOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  user: UserOptionalDefaultsWithRelations;
};

export type OrganizationMemberOptionalDefaultsWithRelations = z.infer<typeof OrganizationMemberOptionalDefaultsSchema> & OrganizationMemberOptionalDefaultsRelations

export const OrganizationMemberOptionalDefaultsWithRelationsSchema: z.ZodType<OrganizationMemberOptionalDefaultsWithRelations> = OrganizationMemberOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  user: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// ORGANIZATION MEMBER PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationMemberPartialRelations = {
  organization?: OrganizationPartialWithRelations;
  user?: UserPartialWithRelations;
};

export type OrganizationMemberPartialWithRelations = z.infer<typeof OrganizationMemberPartialSchema> & OrganizationMemberPartialRelations

export const OrganizationMemberPartialWithRelationsSchema: z.ZodType<OrganizationMemberPartialWithRelations> = OrganizationMemberPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
})).partial()

export type OrganizationMemberOptionalDefaultsWithPartialRelations = z.infer<typeof OrganizationMemberOptionalDefaultsSchema> & OrganizationMemberPartialRelations

export const OrganizationMemberOptionalDefaultsWithPartialRelationsSchema: z.ZodType<OrganizationMemberOptionalDefaultsWithPartialRelations> = OrganizationMemberOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export type OrganizationMemberWithPartialRelations = z.infer<typeof OrganizationMemberSchema> & OrganizationMemberPartialRelations

export const OrganizationMemberWithPartialRelationsSchema: z.ZodType<OrganizationMemberWithPartialRelations> = OrganizationMemberSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export default OrganizationMemberSchema;
