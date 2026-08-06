import { z } from 'zod';
import { PersonWithRelationsSchema, PersonPartialWithRelationsSchema, PersonOptionalDefaultsWithRelationsSchema } from './PersonSchema'
import type { PersonWithRelations, PersonPartialWithRelations, PersonOptionalDefaultsWithRelations } from './PersonSchema'
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { VenueWithRelationsSchema, VenuePartialWithRelationsSchema, VenueOptionalDefaultsWithRelationsSchema } from './VenueSchema'
import type { VenueWithRelations, VenuePartialWithRelations, VenueOptionalDefaultsWithRelations } from './VenueSchema'

/////////////////////////////////////////
// ADDRESS SCHEMA
/////////////////////////////////////////

export const AddressSchema = z.object({
  id: z.number().int(),
  country: z.string().nullish(),
  state: z.string().nullish(),
  province: z.string().nullish(),
  city: z.string().nullish(),
  zipCode: z.string().nullish(),
  address: z.string().nullish(),
  number: z.string().nullish(),
  note: z.string().nullish(),
  default: z.boolean(),
  billing: z.boolean(),
  /**
   * **Non si digita** (§3.4): il servizio la deriva dalla sigla di provincia
   * con la tabella delle province italiane (`@utils/helpers/italianProvinces`),
   * su `create` e su `update`. Non compare in alcun DTO di scrittura.
   * 
   * È una colonna e non un calcolo in lettura perché il filtro geografico
   * della ricerca pubblica dev'essere una condizione INDICIZZATA, e perché un
   * campo libero produrrebbe «Puglia», «PUGLIA» e «Apulia» come tre regioni
   * diverse.
   */
  region: z.string().nullish(),
  personId: z.number().int().nullish(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Address = z.infer<typeof AddressSchema>

/////////////////////////////////////////
// ADDRESS PARTIAL SCHEMA
/////////////////////////////////////////

export const AddressPartialSchema = AddressSchema.partial()

export type AddressPartial = z.infer<typeof AddressPartialSchema>

/////////////////////////////////////////
// ADDRESS OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const AddressOptionalDefaultsSchema = AddressSchema.merge(z.object({
  id: z.number().int().optional(),
  default: z.boolean().optional(),
  billing: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type AddressOptionalDefaults = z.infer<typeof AddressOptionalDefaultsSchema>

/////////////////////////////////////////
// ADDRESS RELATION SCHEMA
/////////////////////////////////////////

export type AddressRelations = {
  person?: PersonWithRelations | null;
  organizations: OrganizationWithRelations[];
  venues: VenueWithRelations[];
};

export type AddressWithRelations = z.infer<typeof AddressSchema> & AddressRelations

export const AddressWithRelationsSchema: z.ZodType<AddressWithRelations> = AddressSchema.merge(z.object({
  person: z.lazy(() => PersonWithRelationsSchema).nullish(),
  organizations: z.lazy(() => OrganizationWithRelationsSchema).array(),
  venues: z.lazy(() => VenueWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ADDRESS OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type AddressOptionalDefaultsRelations = {
  person?: PersonOptionalDefaultsWithRelations | null;
  organizations: OrganizationOptionalDefaultsWithRelations[];
  venues: VenueOptionalDefaultsWithRelations[];
};

export type AddressOptionalDefaultsWithRelations = z.infer<typeof AddressOptionalDefaultsSchema> & AddressOptionalDefaultsRelations

export const AddressOptionalDefaultsWithRelationsSchema: z.ZodType<AddressOptionalDefaultsWithRelations> = AddressOptionalDefaultsSchema.merge(z.object({
  person: z.lazy(() => PersonOptionalDefaultsWithRelationsSchema).nullish(),
  organizations: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema).array(),
  venues: z.lazy(() => VenueOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ADDRESS PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type AddressPartialRelations = {
  person?: PersonPartialWithRelations | null;
  organizations?: OrganizationPartialWithRelations[];
  venues?: VenuePartialWithRelations[];
};

export type AddressPartialWithRelations = z.infer<typeof AddressPartialSchema> & AddressPartialRelations

export const AddressPartialWithRelationsSchema: z.ZodType<AddressPartialWithRelations> = AddressPartialSchema.merge(z.object({
  person: z.lazy(() => PersonPartialWithRelationsSchema).nullish(),
  organizations: z.lazy(() => OrganizationPartialWithRelationsSchema).array(),
  venues: z.lazy(() => VenuePartialWithRelationsSchema).array(),
})).partial()

export type AddressOptionalDefaultsWithPartialRelations = z.infer<typeof AddressOptionalDefaultsSchema> & AddressPartialRelations

export const AddressOptionalDefaultsWithPartialRelationsSchema: z.ZodType<AddressOptionalDefaultsWithPartialRelations> = AddressOptionalDefaultsSchema.merge(z.object({
  person: z.lazy(() => PersonPartialWithRelationsSchema).nullish(),
  organizations: z.lazy(() => OrganizationPartialWithRelationsSchema).array(),
  venues: z.lazy(() => VenuePartialWithRelationsSchema).array(),
}).partial())

export type AddressWithPartialRelations = z.infer<typeof AddressSchema> & AddressPartialRelations

export const AddressWithPartialRelationsSchema: z.ZodType<AddressWithPartialRelations> = AddressSchema.merge(z.object({
  person: z.lazy(() => PersonPartialWithRelationsSchema).nullish(),
  organizations: z.lazy(() => OrganizationPartialWithRelationsSchema).array(),
  venues: z.lazy(() => VenuePartialWithRelationsSchema).array(),
}).partial())

export default AddressSchema;
