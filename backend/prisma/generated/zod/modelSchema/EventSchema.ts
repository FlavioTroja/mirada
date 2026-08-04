import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { EventStatusSchema } from '../inputTypeSchemas/EventStatusSchema'
import { SalesCloseCriterionSchema } from '../inputTypeSchemas/SalesCloseCriterionSchema'
import type { JsonValueType } from '../inputTypeSchemas/JsonValueSchema';
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { EventTypeWithRelationsSchema, EventTypePartialWithRelationsSchema, EventTypeOptionalDefaultsWithRelationsSchema } from './EventTypeSchema'
import type { EventTypeWithRelations, EventTypePartialWithRelations, EventTypeOptionalDefaultsWithRelations } from './EventTypeSchema'
import { VenueWithRelationsSchema, VenuePartialWithRelationsSchema, VenueOptionalDefaultsWithRelationsSchema } from './VenueSchema'
import type { VenueWithRelations, VenuePartialWithRelations, VenueOptionalDefaultsWithRelations } from './VenueSchema'
import { FileWithRelationsSchema, FilePartialWithRelationsSchema, FileOptionalDefaultsWithRelationsSchema } from './FileSchema'
import type { FileWithRelations, FilePartialWithRelations, FileOptionalDefaultsWithRelations } from './FileSchema'
import { RefundPolicyWithRelationsSchema, RefundPolicyPartialWithRelationsSchema, RefundPolicyOptionalDefaultsWithRelationsSchema } from './RefundPolicySchema'
import type { RefundPolicyWithRelations, RefundPolicyPartialWithRelations, RefundPolicyOptionalDefaultsWithRelations } from './RefundPolicySchema'
import { SessionWithRelationsSchema, SessionPartialWithRelationsSchema, SessionOptionalDefaultsWithRelationsSchema } from './SessionSchema'
import type { SessionWithRelations, SessionPartialWithRelations, SessionOptionalDefaultsWithRelations } from './SessionSchema'
import { EventCastWithRelationsSchema, EventCastPartialWithRelationsSchema, EventCastOptionalDefaultsWithRelationsSchema } from './EventCastSchema'
import type { EventCastWithRelations, EventCastPartialWithRelations, EventCastOptionalDefaultsWithRelations } from './EventCastSchema'
import { EventRequirementWithRelationsSchema, EventRequirementPartialWithRelationsSchema, EventRequirementOptionalDefaultsWithRelationsSchema } from './EventRequirementSchema'
import type { EventRequirementWithRelations, EventRequirementPartialWithRelations, EventRequirementOptionalDefaultsWithRelations } from './EventRequirementSchema'
import { EventServiceWithRelationsSchema, EventServicePartialWithRelationsSchema, EventServiceOptionalDefaultsWithRelationsSchema } from './EventServiceSchema'
import type { EventServiceWithRelations, EventServicePartialWithRelations, EventServiceOptionalDefaultsWithRelations } from './EventServiceSchema'
import { TicketTypeWithRelationsSchema, TicketTypePartialWithRelationsSchema, TicketTypeOptionalDefaultsWithRelationsSchema } from './TicketTypeSchema'
import type { TicketTypeWithRelations, TicketTypePartialWithRelations, TicketTypeOptionalDefaultsWithRelations } from './TicketTypeSchema'
import { FiscalDeclarationWithRelationsSchema, FiscalDeclarationPartialWithRelationsSchema, FiscalDeclarationOptionalDefaultsWithRelationsSchema } from './FiscalDeclarationSchema'
import type { FiscalDeclarationWithRelations, FiscalDeclarationPartialWithRelations, FiscalDeclarationOptionalDefaultsWithRelations } from './FiscalDeclarationSchema'
import { CapacityQuotaWithRelationsSchema, CapacityQuotaPartialWithRelationsSchema, CapacityQuotaOptionalDefaultsWithRelationsSchema } from './CapacityQuotaSchema'
import type { CapacityQuotaWithRelations, CapacityQuotaPartialWithRelations, CapacityQuotaOptionalDefaultsWithRelations } from './CapacityQuotaSchema'
import { CoupleWithRelationsSchema, CouplePartialWithRelationsSchema, CoupleOptionalDefaultsWithRelationsSchema } from './CoupleSchema'
import type { CoupleWithRelations, CouplePartialWithRelations, CoupleOptionalDefaultsWithRelations } from './CoupleSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'

/////////////////////////////////////////
// EVENT SCHEMA
/////////////////////////////////////////

export const EventSchema = z.object({
  /**
   * Governato dalle transizioni del servizio, mai scritto dal DTO Create (§4.5).
   */
  status: EventStatusSchema,
  /**
   * Vedi la nota su `tags`: l'assenza di criteri configurati è l'insieme vuoto,
   * e `EVENT_START` resta comunque sempre attivo come ultimo (`RF-EVT-40`).
   */
  salesCloseCriteria: SalesCloseCriterionSchema.array(),
  id: z.number().int(),
  organizationId: z.number().int(),
  eventTypeId: z.number().int(),
  venueId: z.number().int(),
  /**
   * I18nText { it, en? }
   */
  title: JsonValueSchema,
  /**
   * Unico GLOBALE: è la chiave di `GET /api/public/events/:slug` (§4.5).
   */
  slug: z.string(),
  /**
   * I18nText { it, en? }
   */
  description: JsonValueSchema,
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  contentLanguage: z.string(),
  secondLanguage: z.string().nullish(),
  /**
   * `@default([])` è necessario, non cosmetico: senza, `zod-prisma-types` rende
   * la lista OBBLIGATORIA nel DTO Create e il client dovrebbe mandare `[]`
   * per dire «nessun tag». L'assenza deve significare l'insieme vuoto.
   */
  tags: z.string().array(),
  posterVerticalFileId: z.number().int().nullish(),
  posterHorizontalFileId: z.number().int().nullish(),
  posterSquareFileId: z.number().int().nullish(),
  refundPolicyId: z.number().int().nullish(),
  /**
   * I18nText { it, en? }
   */
  refundPolicyText: JsonValueSchema,
  minorsAdmitted: z.boolean(),
  /**
   * I18nText { it, en? }
   */
  minorsConditions: JsonValueSchema.nullable(),
  salesCloseAt: z.coerce.date().nullish(),
  manageExternalChannels: z.boolean(),
  publishedAt: z.coerce.date().nullish(),
  cancelledAt: z.coerce.date().nullish(),
  cancellationReason: z.string().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Event = z.infer<typeof EventSchema>

/////////////////////////////////////////
// EVENT PARTIAL SCHEMA
/////////////////////////////////////////

export const EventPartialSchema = EventSchema.partial()

export type EventPartial = z.infer<typeof EventPartialSchema>

/////////////////////////////////////////
// EVENT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const EventOptionalDefaultsSchema = EventSchema.merge(z.object({
  /**
   * Governato dalle transizioni del servizio, mai scritto dal DTO Create (§4.5).
   */
  status: EventStatusSchema.optional(),
  /**
   * Vedi la nota su `tags`: l'assenza di criteri configurati è l'insieme vuoto,
   * e `EVENT_START` resta comunque sempre attivo come ultimo (`RF-EVT-40`).
   */
  salesCloseCriteria: SalesCloseCriterionSchema.array().optional(),
  id: z.number().int().optional(),
  /**
   * `@default([])` è necessario, non cosmetico: senza, `zod-prisma-types` rende
   * la lista OBBLIGATORIA nel DTO Create e il client dovrebbe mandare `[]`
   * per dire «nessun tag». L'assenza deve significare l'insieme vuoto.
   */
  tags: z.string().array().optional(),
  /**
   * I18nText { it, en? }
   */
  refundPolicyText: JsonValueSchema,
  minorsAdmitted: z.boolean().optional(),
  manageExternalChannels: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type EventOptionalDefaults = z.infer<typeof EventOptionalDefaultsSchema>

/////////////////////////////////////////
// EVENT RELATION SCHEMA
/////////////////////////////////////////

export type EventRelations = {
  organization: OrganizationWithRelations;
  eventType: EventTypeWithRelations;
  venue: VenueWithRelations;
  posterVerticalFile?: FileWithRelations | null;
  posterHorizontalFile?: FileWithRelations | null;
  posterSquareFile?: FileWithRelations | null;
  refundPolicy?: RefundPolicyWithRelations | null;
  sessions: SessionWithRelations[];
  casts: EventCastWithRelations[];
  requirements: EventRequirementWithRelations[];
  services: EventServiceWithRelations[];
  ticketTypes: TicketTypeWithRelations[];
  fiscalDeclarations: FiscalDeclarationWithRelations[];
  capacityQuotas: CapacityQuotaWithRelations[];
  couples: CoupleWithRelations[];
  registrations: RegistrationWithRelations[];
};

export type EventWithRelations = Omit<z.infer<typeof EventSchema>, "minorsConditions"> & {
  minorsConditions?: JsonValueType | null;
} & EventRelations

export const EventWithRelationsSchema: z.ZodType<EventWithRelations> = EventSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  eventType: z.lazy(() => EventTypeWithRelationsSchema),
  venue: z.lazy(() => VenueWithRelationsSchema),
  posterVerticalFile: z.lazy(() => FileWithRelationsSchema).nullish(),
  posterHorizontalFile: z.lazy(() => FileWithRelationsSchema).nullish(),
  posterSquareFile: z.lazy(() => FileWithRelationsSchema).nullish(),
  refundPolicy: z.lazy(() => RefundPolicyWithRelationsSchema).nullish(),
  sessions: z.lazy(() => SessionWithRelationsSchema).array(),
  casts: z.lazy(() => EventCastWithRelationsSchema).array(),
  requirements: z.lazy(() => EventRequirementWithRelationsSchema).array(),
  services: z.lazy(() => EventServiceWithRelationsSchema).array(),
  ticketTypes: z.lazy(() => TicketTypeWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationWithRelationsSchema).array(),
  capacityQuotas: z.lazy(() => CapacityQuotaWithRelationsSchema).array(),
  couples: z.lazy(() => CoupleWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// EVENT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type EventOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  eventType: EventTypeOptionalDefaultsWithRelations;
  venue: VenueOptionalDefaultsWithRelations;
  posterVerticalFile?: FileOptionalDefaultsWithRelations | null;
  posterHorizontalFile?: FileOptionalDefaultsWithRelations | null;
  posterSquareFile?: FileOptionalDefaultsWithRelations | null;
  refundPolicy?: RefundPolicyOptionalDefaultsWithRelations | null;
  sessions: SessionOptionalDefaultsWithRelations[];
  casts: EventCastOptionalDefaultsWithRelations[];
  requirements: EventRequirementOptionalDefaultsWithRelations[];
  services: EventServiceOptionalDefaultsWithRelations[];
  ticketTypes: TicketTypeOptionalDefaultsWithRelations[];
  fiscalDeclarations: FiscalDeclarationOptionalDefaultsWithRelations[];
  capacityQuotas: CapacityQuotaOptionalDefaultsWithRelations[];
  couples: CoupleOptionalDefaultsWithRelations[];
  registrations: RegistrationOptionalDefaultsWithRelations[];
};

export type EventOptionalDefaultsWithRelations = Omit<z.infer<typeof EventOptionalDefaultsSchema>, "minorsConditions"> & {
  minorsConditions?: JsonValueType | null;
} & EventOptionalDefaultsRelations

export const EventOptionalDefaultsWithRelationsSchema: z.ZodType<EventOptionalDefaultsWithRelations> = EventOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  eventType: z.lazy(() => EventTypeOptionalDefaultsWithRelationsSchema),
  venue: z.lazy(() => VenueOptionalDefaultsWithRelationsSchema),
  posterVerticalFile: z.lazy(() => FileOptionalDefaultsWithRelationsSchema).nullish(),
  posterHorizontalFile: z.lazy(() => FileOptionalDefaultsWithRelationsSchema).nullish(),
  posterSquareFile: z.lazy(() => FileOptionalDefaultsWithRelationsSchema).nullish(),
  refundPolicy: z.lazy(() => RefundPolicyOptionalDefaultsWithRelationsSchema).nullish(),
  sessions: z.lazy(() => SessionOptionalDefaultsWithRelationsSchema).array(),
  casts: z.lazy(() => EventCastOptionalDefaultsWithRelationsSchema).array(),
  requirements: z.lazy(() => EventRequirementOptionalDefaultsWithRelationsSchema).array(),
  services: z.lazy(() => EventServiceOptionalDefaultsWithRelationsSchema).array(),
  ticketTypes: z.lazy(() => TicketTypeOptionalDefaultsWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationOptionalDefaultsWithRelationsSchema).array(),
  capacityQuotas: z.lazy(() => CapacityQuotaOptionalDefaultsWithRelationsSchema).array(),
  couples: z.lazy(() => CoupleOptionalDefaultsWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// EVENT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type EventPartialRelations = {
  organization?: OrganizationPartialWithRelations;
  eventType?: EventTypePartialWithRelations;
  venue?: VenuePartialWithRelations;
  posterVerticalFile?: FilePartialWithRelations | null;
  posterHorizontalFile?: FilePartialWithRelations | null;
  posterSquareFile?: FilePartialWithRelations | null;
  refundPolicy?: RefundPolicyPartialWithRelations | null;
  sessions?: SessionPartialWithRelations[];
  casts?: EventCastPartialWithRelations[];
  requirements?: EventRequirementPartialWithRelations[];
  services?: EventServicePartialWithRelations[];
  ticketTypes?: TicketTypePartialWithRelations[];
  fiscalDeclarations?: FiscalDeclarationPartialWithRelations[];
  capacityQuotas?: CapacityQuotaPartialWithRelations[];
  couples?: CouplePartialWithRelations[];
  registrations?: RegistrationPartialWithRelations[];
};

export type EventPartialWithRelations = Omit<z.infer<typeof EventPartialSchema>, "minorsConditions"> & {
  minorsConditions?: JsonValueType | null;
} & EventPartialRelations

export const EventPartialWithRelationsSchema: z.ZodType<EventPartialWithRelations> = EventPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  eventType: z.lazy(() => EventTypePartialWithRelationsSchema),
  venue: z.lazy(() => VenuePartialWithRelationsSchema),
  posterVerticalFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  posterHorizontalFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  posterSquareFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  refundPolicy: z.lazy(() => RefundPolicyPartialWithRelationsSchema).nullish(),
  sessions: z.lazy(() => SessionPartialWithRelationsSchema).array(),
  casts: z.lazy(() => EventCastPartialWithRelationsSchema).array(),
  requirements: z.lazy(() => EventRequirementPartialWithRelationsSchema).array(),
  services: z.lazy(() => EventServicePartialWithRelationsSchema).array(),
  ticketTypes: z.lazy(() => TicketTypePartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  capacityQuotas: z.lazy(() => CapacityQuotaPartialWithRelationsSchema).array(),
  couples: z.lazy(() => CouplePartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
})).partial()

export type EventOptionalDefaultsWithPartialRelations = Omit<z.infer<typeof EventOptionalDefaultsSchema>, "minorsConditions"> & {
  minorsConditions?: JsonValueType | null;
} & EventPartialRelations

export const EventOptionalDefaultsWithPartialRelationsSchema: z.ZodType<EventOptionalDefaultsWithPartialRelations> = EventOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  eventType: z.lazy(() => EventTypePartialWithRelationsSchema),
  venue: z.lazy(() => VenuePartialWithRelationsSchema),
  posterVerticalFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  posterHorizontalFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  posterSquareFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  refundPolicy: z.lazy(() => RefundPolicyPartialWithRelationsSchema).nullish(),
  sessions: z.lazy(() => SessionPartialWithRelationsSchema).array(),
  casts: z.lazy(() => EventCastPartialWithRelationsSchema).array(),
  requirements: z.lazy(() => EventRequirementPartialWithRelationsSchema).array(),
  services: z.lazy(() => EventServicePartialWithRelationsSchema).array(),
  ticketTypes: z.lazy(() => TicketTypePartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  capacityQuotas: z.lazy(() => CapacityQuotaPartialWithRelationsSchema).array(),
  couples: z.lazy(() => CouplePartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
}).partial())

export type EventWithPartialRelations = Omit<z.infer<typeof EventSchema>, "minorsConditions"> & {
  minorsConditions?: JsonValueType | null;
} & EventPartialRelations

export const EventWithPartialRelationsSchema: z.ZodType<EventWithPartialRelations> = EventSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  eventType: z.lazy(() => EventTypePartialWithRelationsSchema),
  venue: z.lazy(() => VenuePartialWithRelationsSchema),
  posterVerticalFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  posterHorizontalFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  posterSquareFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  refundPolicy: z.lazy(() => RefundPolicyPartialWithRelationsSchema).nullish(),
  sessions: z.lazy(() => SessionPartialWithRelationsSchema).array(),
  casts: z.lazy(() => EventCastPartialWithRelationsSchema).array(),
  requirements: z.lazy(() => EventRequirementPartialWithRelationsSchema).array(),
  services: z.lazy(() => EventServicePartialWithRelationsSchema).array(),
  ticketTypes: z.lazy(() => TicketTypePartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  capacityQuotas: z.lazy(() => CapacityQuotaPartialWithRelationsSchema).array(),
  couples: z.lazy(() => CouplePartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
}).partial())

export default EventSchema;
