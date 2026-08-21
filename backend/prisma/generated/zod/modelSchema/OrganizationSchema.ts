import { z } from 'zod';
import { OrganizationStatusSchema } from '../inputTypeSchemas/OrganizationStatusSchema'
import { PayoutStatusSchema } from '../inputTypeSchemas/PayoutStatusSchema'
import { AddressWithRelationsSchema, AddressPartialWithRelationsSchema, AddressOptionalDefaultsWithRelationsSchema } from './AddressSchema'
import type { AddressWithRelations, AddressPartialWithRelations, AddressOptionalDefaultsWithRelations } from './AddressSchema'
import { FileWithRelationsSchema, FilePartialWithRelationsSchema, FileOptionalDefaultsWithRelationsSchema } from './FileSchema'
import type { FileWithRelations, FilePartialWithRelations, FileOptionalDefaultsWithRelations } from './FileSchema'
import { OrganizationMemberWithRelationsSchema, OrganizationMemberPartialWithRelationsSchema, OrganizationMemberOptionalDefaultsWithRelationsSchema } from './OrganizationMemberSchema'
import type { OrganizationMemberWithRelations, OrganizationMemberPartialWithRelations, OrganizationMemberOptionalDefaultsWithRelations } from './OrganizationMemberSchema'
import { OrganizationInvitationWithRelationsSchema, OrganizationInvitationPartialWithRelationsSchema, OrganizationInvitationOptionalDefaultsWithRelationsSchema } from './OrganizationInvitationSchema'
import type { OrganizationInvitationWithRelations, OrganizationInvitationPartialWithRelations, OrganizationInvitationOptionalDefaultsWithRelations } from './OrganizationInvitationSchema'
import { OrderWithRelationsSchema, OrderPartialWithRelationsSchema, OrderOptionalDefaultsWithRelationsSchema } from './OrderSchema'
import type { OrderWithRelations, OrderPartialWithRelations, OrderOptionalDefaultsWithRelations } from './OrderSchema'
import { VenueWithRelationsSchema, VenuePartialWithRelationsSchema, VenueOptionalDefaultsWithRelationsSchema } from './VenueSchema'
import type { VenueWithRelations, VenuePartialWithRelations, VenueOptionalDefaultsWithRelations } from './VenueSchema'
import { ArtistWithRelationsSchema, ArtistPartialWithRelationsSchema, ArtistOptionalDefaultsWithRelationsSchema } from './ArtistSchema'
import type { ArtistWithRelations, ArtistPartialWithRelations, ArtistOptionalDefaultsWithRelations } from './ArtistSchema'
import { RefundPolicyWithRelationsSchema, RefundPolicyPartialWithRelationsSchema, RefundPolicyOptionalDefaultsWithRelationsSchema } from './RefundPolicySchema'
import type { RefundPolicyWithRelations, RefundPolicyPartialWithRelations, RefundPolicyOptionalDefaultsWithRelations } from './RefundPolicySchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { FiscalDeclarationWithRelationsSchema, FiscalDeclarationPartialWithRelationsSchema, FiscalDeclarationOptionalDefaultsWithRelationsSchema } from './FiscalDeclarationSchema'
import type { FiscalDeclarationWithRelations, FiscalDeclarationPartialWithRelations, FiscalDeclarationOptionalDefaultsWithRelations } from './FiscalDeclarationSchema'
import { SalesChannelWithRelationsSchema, SalesChannelPartialWithRelationsSchema, SalesChannelOptionalDefaultsWithRelationsSchema } from './SalesChannelSchema'
import type { SalesChannelWithRelations, SalesChannelPartialWithRelations, SalesChannelOptionalDefaultsWithRelations } from './SalesChannelSchema'

/////////////////////////////////////////
// ORGANIZATION SCHEMA
/////////////////////////////////////////

export const OrganizationSchema = z.object({
  status: OrganizationStatusSchema,
  payoutStatus: PayoutStatusSchema,
  id: z.number().int(),
  name: z.string(),
  /**
   * ⚠️ Ragione sociale e forma giuridica sono **facoltative alla nascita** e
   * obbligatorie **prima di pubblicare** (`EventService.publish`).
   * 
   * Da quando un organizzatore può aprirsi l'organizzazione da solo, questi
   * campi non possono più essere pretesi all'apertura: chi si iscrive la sera
   * per provare la piattaforma non ha sottomano la visura, e un modulo che
   * chiede la forma giuridica al primo passo è un modulo che nessuno finisce.
   * Il dato serve quando serve davvero — cioè quando si comincia a vendere
   * biglietti e a emettere documenti fiscali.
   */
  legalName: z.string().nullish(),
  legalForm: z.string().nullish(),
  vatNumber: z.string().nullish(),
  taxCode: z.string().nullish(),
  addressId: z.number().int().nullish(),
  contactEmail: z.string(),
  contactPhone: z.string().nullish(),
  website: z.string().nullish(),
  /**
   * Calcolati dal server a partire da Stripe — mai accettati dal client (§4.2, §5).
   */
  stripeAccountId: z.string().nullish(),
  payoutCheckedAt: z.coerce.date().nullish(),
  termsVersion: z.string().nullish(),
  termsAcceptedAt: z.coerce.date().nullish(),
  logoFileId: z.number().int().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Organization = z.infer<typeof OrganizationSchema>

/////////////////////////////////////////
// ORGANIZATION PARTIAL SCHEMA
/////////////////////////////////////////

export const OrganizationPartialSchema = OrganizationSchema.partial()

export type OrganizationPartial = z.infer<typeof OrganizationPartialSchema>

/////////////////////////////////////////
// ORGANIZATION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const OrganizationOptionalDefaultsSchema = OrganizationSchema.merge(z.object({
  status: OrganizationStatusSchema.optional(),
  payoutStatus: PayoutStatusSchema.optional(),
  id: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type OrganizationOptionalDefaults = z.infer<typeof OrganizationOptionalDefaultsSchema>

/////////////////////////////////////////
// ORGANIZATION RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationRelations = {
  address?: AddressWithRelations | null;
  logoFile?: FileWithRelations | null;
  members: OrganizationMemberWithRelations[];
  invitations: OrganizationInvitationWithRelations[];
  orders: OrderWithRelations[];
  venues: VenueWithRelations[];
  artists: ArtistWithRelations[];
  refundPolicies: RefundPolicyWithRelations[];
  events: EventWithRelations[];
  fiscalDeclarations: FiscalDeclarationWithRelations[];
  salesChannels: SalesChannelWithRelations[];
};

export type OrganizationWithRelations = z.infer<typeof OrganizationSchema> & OrganizationRelations

export const OrganizationWithRelationsSchema: z.ZodType<OrganizationWithRelations> = OrganizationSchema.merge(z.object({
  address: z.lazy(() => AddressWithRelationsSchema).nullish(),
  logoFile: z.lazy(() => FileWithRelationsSchema).nullish(),
  members: z.lazy(() => OrganizationMemberWithRelationsSchema).array(),
  invitations: z.lazy(() => OrganizationInvitationWithRelationsSchema).array(),
  orders: z.lazy(() => OrderWithRelationsSchema).array(),
  venues: z.lazy(() => VenueWithRelationsSchema).array(),
  artists: z.lazy(() => ArtistWithRelationsSchema).array(),
  refundPolicies: z.lazy(() => RefundPolicyWithRelationsSchema).array(),
  events: z.lazy(() => EventWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationWithRelationsSchema).array(),
  salesChannels: z.lazy(() => SalesChannelWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ORGANIZATION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationOptionalDefaultsRelations = {
  address?: AddressOptionalDefaultsWithRelations | null;
  logoFile?: FileOptionalDefaultsWithRelations | null;
  members: OrganizationMemberOptionalDefaultsWithRelations[];
  invitations: OrganizationInvitationOptionalDefaultsWithRelations[];
  orders: OrderOptionalDefaultsWithRelations[];
  venues: VenueOptionalDefaultsWithRelations[];
  artists: ArtistOptionalDefaultsWithRelations[];
  refundPolicies: RefundPolicyOptionalDefaultsWithRelations[];
  events: EventOptionalDefaultsWithRelations[];
  fiscalDeclarations: FiscalDeclarationOptionalDefaultsWithRelations[];
  salesChannels: SalesChannelOptionalDefaultsWithRelations[];
};

export type OrganizationOptionalDefaultsWithRelations = z.infer<typeof OrganizationOptionalDefaultsSchema> & OrganizationOptionalDefaultsRelations

export const OrganizationOptionalDefaultsWithRelationsSchema: z.ZodType<OrganizationOptionalDefaultsWithRelations> = OrganizationOptionalDefaultsSchema.merge(z.object({
  address: z.lazy(() => AddressOptionalDefaultsWithRelationsSchema).nullish(),
  logoFile: z.lazy(() => FileOptionalDefaultsWithRelationsSchema).nullish(),
  members: z.lazy(() => OrganizationMemberOptionalDefaultsWithRelationsSchema).array(),
  invitations: z.lazy(() => OrganizationInvitationOptionalDefaultsWithRelationsSchema).array(),
  orders: z.lazy(() => OrderOptionalDefaultsWithRelationsSchema).array(),
  venues: z.lazy(() => VenueOptionalDefaultsWithRelationsSchema).array(),
  artists: z.lazy(() => ArtistOptionalDefaultsWithRelationsSchema).array(),
  refundPolicies: z.lazy(() => RefundPolicyOptionalDefaultsWithRelationsSchema).array(),
  events: z.lazy(() => EventOptionalDefaultsWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationOptionalDefaultsWithRelationsSchema).array(),
  salesChannels: z.lazy(() => SalesChannelOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ORGANIZATION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationPartialRelations = {
  address?: AddressPartialWithRelations | null;
  logoFile?: FilePartialWithRelations | null;
  members?: OrganizationMemberPartialWithRelations[];
  invitations?: OrganizationInvitationPartialWithRelations[];
  orders?: OrderPartialWithRelations[];
  venues?: VenuePartialWithRelations[];
  artists?: ArtistPartialWithRelations[];
  refundPolicies?: RefundPolicyPartialWithRelations[];
  events?: EventPartialWithRelations[];
  fiscalDeclarations?: FiscalDeclarationPartialWithRelations[];
  salesChannels?: SalesChannelPartialWithRelations[];
};

export type OrganizationPartialWithRelations = z.infer<typeof OrganizationPartialSchema> & OrganizationPartialRelations

export const OrganizationPartialWithRelationsSchema: z.ZodType<OrganizationPartialWithRelations> = OrganizationPartialSchema.merge(z.object({
  address: z.lazy(() => AddressPartialWithRelationsSchema).nullish(),
  logoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  members: z.lazy(() => OrganizationMemberPartialWithRelationsSchema).array(),
  invitations: z.lazy(() => OrganizationInvitationPartialWithRelationsSchema).array(),
  orders: z.lazy(() => OrderPartialWithRelationsSchema).array(),
  venues: z.lazy(() => VenuePartialWithRelationsSchema).array(),
  artists: z.lazy(() => ArtistPartialWithRelationsSchema).array(),
  refundPolicies: z.lazy(() => RefundPolicyPartialWithRelationsSchema).array(),
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  salesChannels: z.lazy(() => SalesChannelPartialWithRelationsSchema).array(),
})).partial()

export type OrganizationOptionalDefaultsWithPartialRelations = z.infer<typeof OrganizationOptionalDefaultsSchema> & OrganizationPartialRelations

export const OrganizationOptionalDefaultsWithPartialRelationsSchema: z.ZodType<OrganizationOptionalDefaultsWithPartialRelations> = OrganizationOptionalDefaultsSchema.merge(z.object({
  address: z.lazy(() => AddressPartialWithRelationsSchema).nullish(),
  logoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  members: z.lazy(() => OrganizationMemberPartialWithRelationsSchema).array(),
  invitations: z.lazy(() => OrganizationInvitationPartialWithRelationsSchema).array(),
  orders: z.lazy(() => OrderPartialWithRelationsSchema).array(),
  venues: z.lazy(() => VenuePartialWithRelationsSchema).array(),
  artists: z.lazy(() => ArtistPartialWithRelationsSchema).array(),
  refundPolicies: z.lazy(() => RefundPolicyPartialWithRelationsSchema).array(),
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  salesChannels: z.lazy(() => SalesChannelPartialWithRelationsSchema).array(),
}).partial())

export type OrganizationWithPartialRelations = z.infer<typeof OrganizationSchema> & OrganizationPartialRelations

export const OrganizationWithPartialRelationsSchema: z.ZodType<OrganizationWithPartialRelations> = OrganizationSchema.merge(z.object({
  address: z.lazy(() => AddressPartialWithRelationsSchema).nullish(),
  logoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  members: z.lazy(() => OrganizationMemberPartialWithRelationsSchema).array(),
  invitations: z.lazy(() => OrganizationInvitationPartialWithRelationsSchema).array(),
  orders: z.lazy(() => OrderPartialWithRelationsSchema).array(),
  venues: z.lazy(() => VenuePartialWithRelationsSchema).array(),
  artists: z.lazy(() => ArtistPartialWithRelationsSchema).array(),
  refundPolicies: z.lazy(() => RefundPolicyPartialWithRelationsSchema).array(),
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  salesChannels: z.lazy(() => SalesChannelPartialWithRelationsSchema).array(),
}).partial())

export default OrganizationSchema;
