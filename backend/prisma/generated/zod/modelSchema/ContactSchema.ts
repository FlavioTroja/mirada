import { z } from 'zod';
import { PersonWithRelationsSchema, PersonPartialWithRelationsSchema, PersonOptionalDefaultsWithRelationsSchema } from './PersonSchema'
import type { PersonWithRelations, PersonPartialWithRelations, PersonOptionalDefaultsWithRelations } from './PersonSchema'

/////////////////////////////////////////
// CONTACT SCHEMA
/////////////////////////////////////////

export const ContactSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  phoneNumber: z.string().nullish(),
  note: z.string().nullish(),
  telephone: z.string().nullish(),
  pec: z.string().nullish(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Contact = z.infer<typeof ContactSchema>

/////////////////////////////////////////
// CONTACT PARTIAL SCHEMA
/////////////////////////////////////////

export const ContactPartialSchema = ContactSchema.partial()

export type ContactPartial = z.infer<typeof ContactPartialSchema>

/////////////////////////////////////////
// CONTACT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const ContactOptionalDefaultsSchema = ContactSchema.merge(z.object({
  id: z.number().int().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type ContactOptionalDefaults = z.infer<typeof ContactOptionalDefaultsSchema>

/////////////////////////////////////////
// CONTACT RELATION SCHEMA
/////////////////////////////////////////

export type ContactRelations = {
  person?: PersonWithRelations | null;
};

export type ContactWithRelations = z.infer<typeof ContactSchema> & ContactRelations

export const ContactWithRelationsSchema: z.ZodType<ContactWithRelations> = ContactSchema.merge(z.object({
  person: z.lazy(() => PersonWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// CONTACT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type ContactOptionalDefaultsRelations = {
  person?: PersonOptionalDefaultsWithRelations | null;
};

export type ContactOptionalDefaultsWithRelations = z.infer<typeof ContactOptionalDefaultsSchema> & ContactOptionalDefaultsRelations

export const ContactOptionalDefaultsWithRelationsSchema: z.ZodType<ContactOptionalDefaultsWithRelations> = ContactOptionalDefaultsSchema.merge(z.object({
  person: z.lazy(() => PersonOptionalDefaultsWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// CONTACT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type ContactPartialRelations = {
  person?: PersonPartialWithRelations | null;
};

export type ContactPartialWithRelations = z.infer<typeof ContactPartialSchema> & ContactPartialRelations

export const ContactPartialWithRelationsSchema: z.ZodType<ContactPartialWithRelations> = ContactPartialSchema.merge(z.object({
  person: z.lazy(() => PersonPartialWithRelationsSchema).nullish(),
})).partial()

export type ContactOptionalDefaultsWithPartialRelations = z.infer<typeof ContactOptionalDefaultsSchema> & ContactPartialRelations

export const ContactOptionalDefaultsWithPartialRelationsSchema: z.ZodType<ContactOptionalDefaultsWithPartialRelations> = ContactOptionalDefaultsSchema.merge(z.object({
  person: z.lazy(() => PersonPartialWithRelationsSchema).nullish(),
}).partial())

export type ContactWithPartialRelations = z.infer<typeof ContactSchema> & ContactPartialRelations

export const ContactWithPartialRelationsSchema: z.ZodType<ContactWithPartialRelations> = ContactSchema.merge(z.object({
  person: z.lazy(() => PersonPartialWithRelationsSchema).nullish(),
}).partial())

export default ContactSchema;
