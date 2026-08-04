import { z } from 'zod';
import { FileWithRelationsSchema, FilePartialWithRelationsSchema, FileOptionalDefaultsWithRelationsSchema } from './FileSchema'
import type { FileWithRelations, FilePartialWithRelations, FileOptionalDefaultsWithRelations } from './FileSchema'
import { PersonWithRelationsSchema, PersonPartialWithRelationsSchema, PersonOptionalDefaultsWithRelationsSchema } from './PersonSchema'
import type { PersonWithRelations, PersonPartialWithRelations, PersonOptionalDefaultsWithRelations } from './PersonSchema'
import { RoleToUserWithRelationsSchema, RoleToUserPartialWithRelationsSchema, RoleToUserOptionalDefaultsWithRelationsSchema } from './RoleToUserSchema'
import type { RoleToUserWithRelations, RoleToUserPartialWithRelations, RoleToUserOptionalDefaultsWithRelations } from './RoleToUserSchema'
import { LogWithRelationsSchema, LogPartialWithRelationsSchema, LogOptionalDefaultsWithRelationsSchema } from './LogSchema'
import type { LogWithRelations, LogPartialWithRelations, LogOptionalDefaultsWithRelations } from './LogSchema'
import { DancerProfileWithRelationsSchema, DancerProfilePartialWithRelationsSchema, DancerProfileOptionalDefaultsWithRelationsSchema } from './DancerProfileSchema'
import type { DancerProfileWithRelations, DancerProfilePartialWithRelations, DancerProfileOptionalDefaultsWithRelations } from './DancerProfileSchema'
import { OrganizationMemberWithRelationsSchema, OrganizationMemberPartialWithRelationsSchema, OrganizationMemberOptionalDefaultsWithRelationsSchema } from './OrganizationMemberSchema'
import type { OrganizationMemberWithRelations, OrganizationMemberPartialWithRelations, OrganizationMemberOptionalDefaultsWithRelations } from './OrganizationMemberSchema'
import { FiscalDeclarationWithRelationsSchema, FiscalDeclarationPartialWithRelationsSchema, FiscalDeclarationOptionalDefaultsWithRelationsSchema } from './FiscalDeclarationSchema'
import type { FiscalDeclarationWithRelations, FiscalDeclarationPartialWithRelations, FiscalDeclarationOptionalDefaultsWithRelations } from './FiscalDeclarationSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'

/////////////////////////////////////////
// USER SCHEMA
/////////////////////////////////////////

export const UserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  password: z.string(),
  wsCode: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  note: z.string().nullish(),
  enabled: z.boolean(),
  activatedAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
  logoFileId: z.number().int().nullish(),
  personId: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type User = z.infer<typeof UserSchema>

/////////////////////////////////////////
// USER PARTIAL SCHEMA
/////////////////////////////////////////

export const UserPartialSchema = UserSchema.partial()

export type UserPartial = z.infer<typeof UserPartialSchema>

/////////////////////////////////////////
// USER OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const UserOptionalDefaultsSchema = UserSchema.merge(z.object({
  id: z.number().int().optional(),
  enabled: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type UserOptionalDefaults = z.infer<typeof UserOptionalDefaultsSchema>

/////////////////////////////////////////
// USER RELATION SCHEMA
/////////////////////////////////////////

export type UserRelations = {
  logoFile?: FileWithRelations | null;
  person: PersonWithRelations;
  roles: RoleToUserWithRelations[];
  logs: LogWithRelations[];
  dancerProfile?: DancerProfileWithRelations | null;
  organizationMemberships: OrganizationMemberWithRelations[];
  fiscalDeclarations: FiscalDeclarationWithRelations[];
  registrations: RegistrationWithRelations[];
  guardedRegistrations: RegistrationWithRelations[];
};

export type UserWithRelations = z.infer<typeof UserSchema> & UserRelations

export const UserWithRelationsSchema: z.ZodType<UserWithRelations> = UserSchema.merge(z.object({
  logoFile: z.lazy(() => FileWithRelationsSchema).nullish(),
  person: z.lazy(() => PersonWithRelationsSchema),
  roles: z.lazy(() => RoleToUserWithRelationsSchema).array(),
  logs: z.lazy(() => LogWithRelationsSchema).array(),
  dancerProfile: z.lazy(() => DancerProfileWithRelationsSchema).nullish(),
  organizationMemberships: z.lazy(() => OrganizationMemberWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationWithRelationsSchema).array(),
  guardedRegistrations: z.lazy(() => RegistrationWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// USER OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type UserOptionalDefaultsRelations = {
  logoFile?: FileOptionalDefaultsWithRelations | null;
  person: PersonOptionalDefaultsWithRelations;
  roles: RoleToUserOptionalDefaultsWithRelations[];
  logs: LogOptionalDefaultsWithRelations[];
  dancerProfile?: DancerProfileOptionalDefaultsWithRelations | null;
  organizationMemberships: OrganizationMemberOptionalDefaultsWithRelations[];
  fiscalDeclarations: FiscalDeclarationOptionalDefaultsWithRelations[];
  registrations: RegistrationOptionalDefaultsWithRelations[];
  guardedRegistrations: RegistrationOptionalDefaultsWithRelations[];
};

export type UserOptionalDefaultsWithRelations = z.infer<typeof UserOptionalDefaultsSchema> & UserOptionalDefaultsRelations

export const UserOptionalDefaultsWithRelationsSchema: z.ZodType<UserOptionalDefaultsWithRelations> = UserOptionalDefaultsSchema.merge(z.object({
  logoFile: z.lazy(() => FileOptionalDefaultsWithRelationsSchema).nullish(),
  person: z.lazy(() => PersonOptionalDefaultsWithRelationsSchema),
  roles: z.lazy(() => RoleToUserOptionalDefaultsWithRelationsSchema).array(),
  logs: z.lazy(() => LogOptionalDefaultsWithRelationsSchema).array(),
  dancerProfile: z.lazy(() => DancerProfileOptionalDefaultsWithRelationsSchema).nullish(),
  organizationMemberships: z.lazy(() => OrganizationMemberOptionalDefaultsWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationOptionalDefaultsWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema).array(),
  guardedRegistrations: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// USER PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type UserPartialRelations = {
  logoFile?: FilePartialWithRelations | null;
  person?: PersonPartialWithRelations;
  roles?: RoleToUserPartialWithRelations[];
  logs?: LogPartialWithRelations[];
  dancerProfile?: DancerProfilePartialWithRelations | null;
  organizationMemberships?: OrganizationMemberPartialWithRelations[];
  fiscalDeclarations?: FiscalDeclarationPartialWithRelations[];
  registrations?: RegistrationPartialWithRelations[];
  guardedRegistrations?: RegistrationPartialWithRelations[];
};

export type UserPartialWithRelations = z.infer<typeof UserPartialSchema> & UserPartialRelations

export const UserPartialWithRelationsSchema: z.ZodType<UserPartialWithRelations> = UserPartialSchema.merge(z.object({
  logoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  person: z.lazy(() => PersonPartialWithRelationsSchema),
  roles: z.lazy(() => RoleToUserPartialWithRelationsSchema).array(),
  logs: z.lazy(() => LogPartialWithRelationsSchema).array(),
  dancerProfile: z.lazy(() => DancerProfilePartialWithRelationsSchema).nullish(),
  organizationMemberships: z.lazy(() => OrganizationMemberPartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  guardedRegistrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
})).partial()

export type UserOptionalDefaultsWithPartialRelations = z.infer<typeof UserOptionalDefaultsSchema> & UserPartialRelations

export const UserOptionalDefaultsWithPartialRelationsSchema: z.ZodType<UserOptionalDefaultsWithPartialRelations> = UserOptionalDefaultsSchema.merge(z.object({
  logoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  person: z.lazy(() => PersonPartialWithRelationsSchema),
  roles: z.lazy(() => RoleToUserPartialWithRelationsSchema).array(),
  logs: z.lazy(() => LogPartialWithRelationsSchema).array(),
  dancerProfile: z.lazy(() => DancerProfilePartialWithRelationsSchema).nullish(),
  organizationMemberships: z.lazy(() => OrganizationMemberPartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  guardedRegistrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
}).partial())

export type UserWithPartialRelations = z.infer<typeof UserSchema> & UserPartialRelations

export const UserWithPartialRelationsSchema: z.ZodType<UserWithPartialRelations> = UserSchema.merge(z.object({
  logoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  person: z.lazy(() => PersonPartialWithRelationsSchema),
  roles: z.lazy(() => RoleToUserPartialWithRelationsSchema).array(),
  logs: z.lazy(() => LogPartialWithRelationsSchema).array(),
  dancerProfile: z.lazy(() => DancerProfilePartialWithRelationsSchema).nullish(),
  organizationMemberships: z.lazy(() => OrganizationMemberPartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  guardedRegistrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
}).partial())

export default UserSchema;
