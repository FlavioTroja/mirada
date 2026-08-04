import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { PreferredDanceRoleSchema } from '../inputTypeSchemas/PreferredDanceRoleSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'
import { FileWithRelationsSchema, FilePartialWithRelationsSchema, FileOptionalDefaultsWithRelationsSchema } from './FileSchema'
import type { FileWithRelations, FilePartialWithRelations, FileOptionalDefaultsWithRelations } from './FileSchema'

/////////////////////////////////////////
// DANCER PROFILE SCHEMA
/////////////////////////////////////////

export const DancerProfileSchema = z.object({
  preferredRole: PreferredDanceRoleSchema,
  id: z.number().int(),
  userId: z.number().int(),
  nickname: z.string(),
  city: z.string().nullish(),
  /**
   * `@default([])` è necessario, non cosmetico: senza, `zod-prisma-types` rende
   * la lista OBBLIGATORIA nel DTO Create e il client dovrebbe mandare `[]` per
   * creare un profilo senza lingue dichiarate. Stesso difetto già corretto su
   * `Event.tags` in fase B (backend-brief §C.4).
   */
  languages: z.string().array(),
  birthDate: z.coerce.date().nullish(),
  declaredLevel: z.string().nullish(),
  avatarFileId: z.number().int().nullish(),
  /**
   * Calcolati dal server dal servizio changeNickname (§4.3).
   */
  nicknameChangedAt: z.coerce.date().nullish(),
  nicknameChangeCount: z.number().int(),
  /**
   * Spazio riservato agli attributi di ballo estensibili di fase 2 (§4.3).
   */
  attributes: JsonValueSchema,
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type DancerProfile = z.infer<typeof DancerProfileSchema>

/////////////////////////////////////////
// DANCER PROFILE PARTIAL SCHEMA
/////////////////////////////////////////

export const DancerProfilePartialSchema = DancerProfileSchema.partial()

export type DancerProfilePartial = z.infer<typeof DancerProfilePartialSchema>

/////////////////////////////////////////
// DANCER PROFILE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const DancerProfileOptionalDefaultsSchema = DancerProfileSchema.merge(z.object({
  preferredRole: PreferredDanceRoleSchema.optional(),
  id: z.number().int().optional(),
  /**
   * `@default([])` è necessario, non cosmetico: senza, `zod-prisma-types` rende
   * la lista OBBLIGATORIA nel DTO Create e il client dovrebbe mandare `[]` per
   * creare un profilo senza lingue dichiarate. Stesso difetto già corretto su
   * `Event.tags` in fase B (backend-brief §C.4).
   */
  languages: z.string().array().optional(),
  nicknameChangeCount: z.number().int().optional(),
  /**
   * Spazio riservato agli attributi di ballo estensibili di fase 2 (§4.3).
   */
  attributes: JsonValueSchema,
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type DancerProfileOptionalDefaults = z.infer<typeof DancerProfileOptionalDefaultsSchema>

/////////////////////////////////////////
// DANCER PROFILE RELATION SCHEMA
/////////////////////////////////////////

export type DancerProfileRelations = {
  user: UserWithRelations;
  avatarFile?: FileWithRelations | null;
};

export type DancerProfileWithRelations = z.infer<typeof DancerProfileSchema> & DancerProfileRelations

export const DancerProfileWithRelationsSchema: z.ZodType<DancerProfileWithRelations> = DancerProfileSchema.merge(z.object({
  user: z.lazy(() => UserWithRelationsSchema),
  avatarFile: z.lazy(() => FileWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// DANCER PROFILE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type DancerProfileOptionalDefaultsRelations = {
  user: UserOptionalDefaultsWithRelations;
  avatarFile?: FileOptionalDefaultsWithRelations | null;
};

export type DancerProfileOptionalDefaultsWithRelations = z.infer<typeof DancerProfileOptionalDefaultsSchema> & DancerProfileOptionalDefaultsRelations

export const DancerProfileOptionalDefaultsWithRelationsSchema: z.ZodType<DancerProfileOptionalDefaultsWithRelations> = DancerProfileOptionalDefaultsSchema.merge(z.object({
  user: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
  avatarFile: z.lazy(() => FileOptionalDefaultsWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// DANCER PROFILE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type DancerProfilePartialRelations = {
  user?: UserPartialWithRelations;
  avatarFile?: FilePartialWithRelations | null;
};

export type DancerProfilePartialWithRelations = z.infer<typeof DancerProfilePartialSchema> & DancerProfilePartialRelations

export const DancerProfilePartialWithRelationsSchema: z.ZodType<DancerProfilePartialWithRelations> = DancerProfilePartialSchema.merge(z.object({
  user: z.lazy(() => UserPartialWithRelationsSchema),
  avatarFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
})).partial()

export type DancerProfileOptionalDefaultsWithPartialRelations = z.infer<typeof DancerProfileOptionalDefaultsSchema> & DancerProfilePartialRelations

export const DancerProfileOptionalDefaultsWithPartialRelationsSchema: z.ZodType<DancerProfileOptionalDefaultsWithPartialRelations> = DancerProfileOptionalDefaultsSchema.merge(z.object({
  user: z.lazy(() => UserPartialWithRelationsSchema),
  avatarFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
}).partial())

export type DancerProfileWithPartialRelations = z.infer<typeof DancerProfileSchema> & DancerProfilePartialRelations

export const DancerProfileWithPartialRelationsSchema: z.ZodType<DancerProfileWithPartialRelations> = DancerProfileSchema.merge(z.object({
  user: z.lazy(() => UserPartialWithRelationsSchema),
  avatarFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
}).partial())

export default DancerProfileSchema;
