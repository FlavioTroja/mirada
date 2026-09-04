import { z } from 'zod';
import { GenderSchema } from '../inputTypeSchemas/GenderSchema'
import { PersonTypeSchema } from '../inputTypeSchemas/PersonTypeSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'
import { ContactWithRelationsSchema, ContactPartialWithRelationsSchema, ContactOptionalDefaultsWithRelationsSchema } from './ContactSchema'
import type { ContactWithRelations, ContactPartialWithRelations, ContactOptionalDefaultsWithRelations } from './ContactSchema'
import { AddressWithRelationsSchema, AddressPartialWithRelationsSchema, AddressOptionalDefaultsWithRelationsSchema } from './AddressSchema'
import type { AddressWithRelations, AddressPartialWithRelations, AddressOptionalDefaultsWithRelations } from './AddressSchema'
import { PersonFileWithRelationsSchema, PersonFilePartialWithRelationsSchema, PersonFileOptionalDefaultsWithRelationsSchema } from './PersonFileSchema'
import type { PersonFileWithRelations, PersonFilePartialWithRelations, PersonFileOptionalDefaultsWithRelations } from './PersonFileSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'

/////////////////////////////////////////
// PERSON SCHEMA
/////////////////////////////////////////

export const PersonSchema = z.object({
  gender: GenderSchema.nullish(),
  personType: PersonTypeSchema,
  id: z.number().int(),
  name: z.string(),
  surname: z.string(),
  birthDate: z.coerce.date().nullish(),
  fiscalCode: z.string().nullish(),
  vatNumber: z.string().nullish(),
  note: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  bornIn: z.string().nullish(),
  livesIn: z.string().nullish(),
  contactId: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Person = z.infer<typeof PersonSchema>

/////////////////////////////////////////
// PERSON PARTIAL SCHEMA
/////////////////////////////////////////

export const PersonPartialSchema = PersonSchema.partial()

export type PersonPartial = z.infer<typeof PersonPartialSchema>

/////////////////////////////////////////
// PERSON OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PersonOptionalDefaultsSchema = PersonSchema.merge(z.object({
  id: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type PersonOptionalDefaults = z.infer<typeof PersonOptionalDefaultsSchema>

/////////////////////////////////////////
// PERSON RELATION SCHEMA
/////////////////////////////////////////

export type PersonRelations = {
  user?: UserWithRelations | null;
  contact: ContactWithRelations;
  addresses: AddressWithRelations[];
  files: PersonFileWithRelations[];
  registrations: RegistrationWithRelations[];
};

export type PersonWithRelations = z.infer<typeof PersonSchema> & PersonRelations

export const PersonWithRelationsSchema: z.ZodType<PersonWithRelations> = PersonSchema.merge(z.object({
  user: z.lazy(() => UserWithRelationsSchema).nullish(),
  contact: z.lazy(() => ContactWithRelationsSchema),
  addresses: z.lazy(() => AddressWithRelationsSchema).array(),
  files: z.lazy(() => PersonFileWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// PERSON OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PersonOptionalDefaultsRelations = {
  user?: UserOptionalDefaultsWithRelations | null;
  contact: ContactOptionalDefaultsWithRelations;
  addresses: AddressOptionalDefaultsWithRelations[];
  files: PersonFileOptionalDefaultsWithRelations[];
  registrations: RegistrationOptionalDefaultsWithRelations[];
};

export type PersonOptionalDefaultsWithRelations = z.infer<typeof PersonOptionalDefaultsSchema> & PersonOptionalDefaultsRelations

export const PersonOptionalDefaultsWithRelationsSchema: z.ZodType<PersonOptionalDefaultsWithRelations> = PersonOptionalDefaultsSchema.merge(z.object({
  user: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullish(),
  contact: z.lazy(() => ContactOptionalDefaultsWithRelationsSchema),
  addresses: z.lazy(() => AddressOptionalDefaultsWithRelationsSchema).array(),
  files: z.lazy(() => PersonFileOptionalDefaultsWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// PERSON PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PersonPartialRelations = {
  user?: UserPartialWithRelations | null;
  contact?: ContactPartialWithRelations;
  addresses?: AddressPartialWithRelations[];
  files?: PersonFilePartialWithRelations[];
  registrations?: RegistrationPartialWithRelations[];
};

export type PersonPartialWithRelations = z.infer<typeof PersonPartialSchema> & PersonPartialRelations

export const PersonPartialWithRelationsSchema: z.ZodType<PersonPartialWithRelations> = PersonPartialSchema.merge(z.object({
  user: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  contact: z.lazy(() => ContactPartialWithRelationsSchema),
  addresses: z.lazy(() => AddressPartialWithRelationsSchema).array(),
  files: z.lazy(() => PersonFilePartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
})).partial()

export type PersonOptionalDefaultsWithPartialRelations = z.infer<typeof PersonOptionalDefaultsSchema> & PersonPartialRelations

export const PersonOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PersonOptionalDefaultsWithPartialRelations> = PersonOptionalDefaultsSchema.merge(z.object({
  user: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  contact: z.lazy(() => ContactPartialWithRelationsSchema),
  addresses: z.lazy(() => AddressPartialWithRelationsSchema).array(),
  files: z.lazy(() => PersonFilePartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
}).partial())

export type PersonWithPartialRelations = z.infer<typeof PersonSchema> & PersonPartialRelations

export const PersonWithPartialRelationsSchema: z.ZodType<PersonWithPartialRelations> = PersonSchema.merge(z.object({
  user: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  contact: z.lazy(() => ContactPartialWithRelationsSchema),
  addresses: z.lazy(() => AddressPartialWithRelationsSchema).array(),
  files: z.lazy(() => PersonFilePartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
}).partial())

export default PersonSchema;
