import { z } from 'zod';
import { PersonWithRelationsSchema, PersonPartialWithRelationsSchema, PersonOptionalDefaultsWithRelationsSchema } from './PersonSchema'
import type { PersonWithRelations, PersonPartialWithRelations, PersonOptionalDefaultsWithRelations } from './PersonSchema'
import { FileWithRelationsSchema, FilePartialWithRelationsSchema, FileOptionalDefaultsWithRelationsSchema } from './FileSchema'
import type { FileWithRelations, FilePartialWithRelations, FileOptionalDefaultsWithRelations } from './FileSchema'

/////////////////////////////////////////
// PERSON FILE SCHEMA
/////////////////////////////////////////

export const PersonFileSchema = z.object({
  personId: z.number().int(),
  fileId: z.number().int(),
  createdAt: z.coerce.date(),
})

export type PersonFile = z.infer<typeof PersonFileSchema>

/////////////////////////////////////////
// PERSON FILE PARTIAL SCHEMA
/////////////////////////////////////////

export const PersonFilePartialSchema = PersonFileSchema.partial()

export type PersonFilePartial = z.infer<typeof PersonFilePartialSchema>

/////////////////////////////////////////
// PERSON FILE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PersonFileOptionalDefaultsSchema = PersonFileSchema.merge(z.object({
  createdAt: z.coerce.date().optional(),
}))

export type PersonFileOptionalDefaults = z.infer<typeof PersonFileOptionalDefaultsSchema>

/////////////////////////////////////////
// PERSON FILE RELATION SCHEMA
/////////////////////////////////////////

export type PersonFileRelations = {
  person: PersonWithRelations;
  file: FileWithRelations;
};

export type PersonFileWithRelations = z.infer<typeof PersonFileSchema> & PersonFileRelations

export const PersonFileWithRelationsSchema: z.ZodType<PersonFileWithRelations> = PersonFileSchema.merge(z.object({
  person: z.lazy(() => PersonWithRelationsSchema),
  file: z.lazy(() => FileWithRelationsSchema),
}))

/////////////////////////////////////////
// PERSON FILE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PersonFileOptionalDefaultsRelations = {
  person: PersonOptionalDefaultsWithRelations;
  file: FileOptionalDefaultsWithRelations;
};

export type PersonFileOptionalDefaultsWithRelations = z.infer<typeof PersonFileOptionalDefaultsSchema> & PersonFileOptionalDefaultsRelations

export const PersonFileOptionalDefaultsWithRelationsSchema: z.ZodType<PersonFileOptionalDefaultsWithRelations> = PersonFileOptionalDefaultsSchema.merge(z.object({
  person: z.lazy(() => PersonOptionalDefaultsWithRelationsSchema),
  file: z.lazy(() => FileOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// PERSON FILE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PersonFilePartialRelations = {
  person?: PersonPartialWithRelations;
  file?: FilePartialWithRelations;
};

export type PersonFilePartialWithRelations = z.infer<typeof PersonFilePartialSchema> & PersonFilePartialRelations

export const PersonFilePartialWithRelationsSchema: z.ZodType<PersonFilePartialWithRelations> = PersonFilePartialSchema.merge(z.object({
  person: z.lazy(() => PersonPartialWithRelationsSchema),
  file: z.lazy(() => FilePartialWithRelationsSchema),
})).partial()

export type PersonFileOptionalDefaultsWithPartialRelations = z.infer<typeof PersonFileOptionalDefaultsSchema> & PersonFilePartialRelations

export const PersonFileOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PersonFileOptionalDefaultsWithPartialRelations> = PersonFileOptionalDefaultsSchema.merge(z.object({
  person: z.lazy(() => PersonPartialWithRelationsSchema),
  file: z.lazy(() => FilePartialWithRelationsSchema),
}).partial())

export type PersonFileWithPartialRelations = z.infer<typeof PersonFileSchema> & PersonFilePartialRelations

export const PersonFileWithPartialRelationsSchema: z.ZodType<PersonFileWithPartialRelations> = PersonFileSchema.merge(z.object({
  person: z.lazy(() => PersonPartialWithRelationsSchema),
  file: z.lazy(() => FilePartialWithRelationsSchema),
}).partial())

export default PersonFileSchema;
