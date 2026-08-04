import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { LevelSchema } from '../inputTypeSchemas/LevelSchema'
import { RoleNameSchema } from '../inputTypeSchemas/RoleNameSchema'
import type { JsonValueType } from '../inputTypeSchemas/JsonValueSchema';
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// LOG SCHEMA
/////////////////////////////////////////

export const LogSchema = z.object({
  level: LevelSchema,
  toRoles: RoleNameSchema.array(),
  id: z.number().int(),
  description: z.string().nullish(),
  entityId: z.number().int().nullish(),
  entityName: z.string().nullish(),
  input: JsonValueSchema.nullable(),
  output: JsonValueSchema.nullable(),
  actionByUsername: z.string().nullish(),
  actionById: z.number().int().nullish(),
  isNotification: z.boolean(),
  hasError: z.boolean(),
  createdAt: z.coerce.date(),
  recipients: JsonValueSchema.nullable(),
})

export type Log = z.infer<typeof LogSchema>

/////////////////////////////////////////
// LOG PARTIAL SCHEMA
/////////////////////////////////////////

export const LogPartialSchema = LogSchema.partial()

export type LogPartial = z.infer<typeof LogPartialSchema>

/////////////////////////////////////////
// LOG OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const LogOptionalDefaultsSchema = LogSchema.merge(z.object({
  level: LevelSchema.optional(),
  toRoles: RoleNameSchema.array().optional(),
  id: z.number().int().optional(),
  isNotification: z.boolean().optional(),
  hasError: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
}))

export type LogOptionalDefaults = z.infer<typeof LogOptionalDefaultsSchema>

/////////////////////////////////////////
// LOG RELATION SCHEMA
/////////////////////////////////////////

export type LogRelations = {
  actionBy?: UserWithRelations | null;
};

export type LogWithRelations = Omit<z.infer<typeof LogSchema>, "input" | "output" | "recipients"> & {
  input?: JsonValueType | null;
  output?: JsonValueType | null;
  recipients?: JsonValueType | null;
} & LogRelations

export const LogWithRelationsSchema: z.ZodType<LogWithRelations> = LogSchema.merge(z.object({
  actionBy: z.lazy(() => UserWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// LOG OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type LogOptionalDefaultsRelations = {
  actionBy?: UserOptionalDefaultsWithRelations | null;
};

export type LogOptionalDefaultsWithRelations = Omit<z.infer<typeof LogOptionalDefaultsSchema>, "input" | "output" | "recipients"> & {
  input?: JsonValueType | null;
  output?: JsonValueType | null;
  recipients?: JsonValueType | null;
} & LogOptionalDefaultsRelations

export const LogOptionalDefaultsWithRelationsSchema: z.ZodType<LogOptionalDefaultsWithRelations> = LogOptionalDefaultsSchema.merge(z.object({
  actionBy: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// LOG PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type LogPartialRelations = {
  actionBy?: UserPartialWithRelations | null;
};

export type LogPartialWithRelations = Omit<z.infer<typeof LogPartialSchema>, "input" | "output" | "recipients"> & {
  input?: JsonValueType | null;
  output?: JsonValueType | null;
  recipients?: JsonValueType | null;
} & LogPartialRelations

export const LogPartialWithRelationsSchema: z.ZodType<LogPartialWithRelations> = LogPartialSchema.merge(z.object({
  actionBy: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
})).partial()

export type LogOptionalDefaultsWithPartialRelations = Omit<z.infer<typeof LogOptionalDefaultsSchema>, "input" | "output" | "recipients"> & {
  input?: JsonValueType | null;
  output?: JsonValueType | null;
  recipients?: JsonValueType | null;
} & LogPartialRelations

export const LogOptionalDefaultsWithPartialRelationsSchema: z.ZodType<LogOptionalDefaultsWithPartialRelations> = LogOptionalDefaultsSchema.merge(z.object({
  actionBy: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
}).partial())

export type LogWithPartialRelations = Omit<z.infer<typeof LogSchema>, "input" | "output" | "recipients"> & {
  input?: JsonValueType | null;
  output?: JsonValueType | null;
  recipients?: JsonValueType | null;
} & LogPartialRelations

export const LogWithPartialRelationsSchema: z.ZodType<LogWithPartialRelations> = LogSchema.merge(z.object({
  actionBy: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
}).partial())

export default LogSchema;
