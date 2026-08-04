import { z } from 'zod';
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { AddressWithRelationsSchema, AddressPartialWithRelationsSchema, AddressOptionalDefaultsWithRelationsSchema } from './AddressSchema'
import type { AddressWithRelations, AddressPartialWithRelations, AddressOptionalDefaultsWithRelations } from './AddressSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'

/////////////////////////////////////////
// VENUE SCHEMA
/////////////////////////////////////////

export const VenueSchema = z.object({
  id: z.number().int(),
  /**
   * Null = sala di piattaforma, non appartenente ad alcuna organizzazione.
   */
  organizationId: z.number().int().nullish(),
  name: z.string(),
  addressId: z.number().int(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  /**
   * Proposta come default alla quota di capienza della sala, mai imposta (§4.4).
   */
  capacity: z.number().int().nullish(),
  floorNotes: z.string().nullish(),
  airConditioning: z.boolean(),
  parking: z.boolean(),
  accessibility: z.string().nullish(),
  notes: z.string().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Venue = z.infer<typeof VenueSchema>

/////////////////////////////////////////
// VENUE PARTIAL SCHEMA
/////////////////////////////////////////

export const VenuePartialSchema = VenueSchema.partial()

export type VenuePartial = z.infer<typeof VenuePartialSchema>

/////////////////////////////////////////
// VENUE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const VenueOptionalDefaultsSchema = VenueSchema.merge(z.object({
  id: z.number().int().optional(),
  airConditioning: z.boolean().optional(),
  parking: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type VenueOptionalDefaults = z.infer<typeof VenueOptionalDefaultsSchema>

/////////////////////////////////////////
// VENUE RELATION SCHEMA
/////////////////////////////////////////

export type VenueRelations = {
  organization?: OrganizationWithRelations | null;
  address: AddressWithRelations;
  events: EventWithRelations[];
};

export type VenueWithRelations = z.infer<typeof VenueSchema> & VenueRelations

export const VenueWithRelationsSchema: z.ZodType<VenueWithRelations> = VenueSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema).nullish(),
  address: z.lazy(() => AddressWithRelationsSchema),
  events: z.lazy(() => EventWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// VENUE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type VenueOptionalDefaultsRelations = {
  organization?: OrganizationOptionalDefaultsWithRelations | null;
  address: AddressOptionalDefaultsWithRelations;
  events: EventOptionalDefaultsWithRelations[];
};

export type VenueOptionalDefaultsWithRelations = z.infer<typeof VenueOptionalDefaultsSchema> & VenueOptionalDefaultsRelations

export const VenueOptionalDefaultsWithRelationsSchema: z.ZodType<VenueOptionalDefaultsWithRelations> = VenueOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema).nullish(),
  address: z.lazy(() => AddressOptionalDefaultsWithRelationsSchema),
  events: z.lazy(() => EventOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// VENUE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type VenuePartialRelations = {
  organization?: OrganizationPartialWithRelations | null;
  address?: AddressPartialWithRelations;
  events?: EventPartialWithRelations[];
};

export type VenuePartialWithRelations = z.infer<typeof VenuePartialSchema> & VenuePartialRelations

export const VenuePartialWithRelationsSchema: z.ZodType<VenuePartialWithRelations> = VenuePartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema).nullish(),
  address: z.lazy(() => AddressPartialWithRelationsSchema),
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
})).partial()

export type VenueOptionalDefaultsWithPartialRelations = z.infer<typeof VenueOptionalDefaultsSchema> & VenuePartialRelations

export const VenueOptionalDefaultsWithPartialRelationsSchema: z.ZodType<VenueOptionalDefaultsWithPartialRelations> = VenueOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema).nullish(),
  address: z.lazy(() => AddressPartialWithRelationsSchema),
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
}).partial())

export type VenueWithPartialRelations = z.infer<typeof VenueSchema> & VenuePartialRelations

export const VenueWithPartialRelationsSchema: z.ZodType<VenueWithPartialRelations> = VenueSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema).nullish(),
  address: z.lazy(() => AddressPartialWithRelationsSchema),
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
}).partial())

export default VenueSchema;
