import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { SaleUnitSchema } from '../inputTypeSchemas/SaleUnitSchema'
import { DanceRoleSchema } from '../inputTypeSchemas/DanceRoleSchema'
import { TicketTypeVisibilitySchema } from '../inputTypeSchemas/TicketTypeVisibilitySchema'
import type { JsonValueType } from '../inputTypeSchemas/JsonValueSchema';
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { TicketTypeSessionWithRelationsSchema, TicketTypeSessionPartialWithRelationsSchema, TicketTypeSessionOptionalDefaultsWithRelationsSchema } from './TicketTypeSessionSchema'
import type { TicketTypeSessionWithRelations, TicketTypeSessionPartialWithRelations, TicketTypeSessionOptionalDefaultsWithRelations } from './TicketTypeSessionSchema'
import { PriceTierWithRelationsSchema, PriceTierPartialWithRelationsSchema, PriceTierOptionalDefaultsWithRelationsSchema } from './PriceTierSchema'
import type { PriceTierWithRelations, PriceTierPartialWithRelations, PriceTierOptionalDefaultsWithRelations } from './PriceTierSchema'
import { OrderLineWithRelationsSchema, OrderLinePartialWithRelationsSchema, OrderLineOptionalDefaultsWithRelationsSchema } from './OrderLineSchema'
import type { OrderLineWithRelations, OrderLinePartialWithRelations, OrderLineOptionalDefaultsWithRelations } from './OrderLineSchema'
import { PassIssuanceWithRelationsSchema, PassIssuancePartialWithRelationsSchema, PassIssuanceOptionalDefaultsWithRelationsSchema } from './PassIssuanceSchema'
import type { PassIssuanceWithRelations, PassIssuancePartialWithRelations, PassIssuanceOptionalDefaultsWithRelations } from './PassIssuanceSchema'
import { TicketWithRelationsSchema, TicketPartialWithRelationsSchema, TicketOptionalDefaultsWithRelationsSchema } from './TicketSchema'
import type { TicketWithRelations, TicketPartialWithRelations, TicketOptionalDefaultsWithRelations } from './TicketSchema'
import { SalesChannelMappingWithRelationsSchema, SalesChannelMappingPartialWithRelationsSchema, SalesChannelMappingOptionalDefaultsWithRelationsSchema } from './SalesChannelMappingSchema'
import type { SalesChannelMappingWithRelations, SalesChannelMappingPartialWithRelations, SalesChannelMappingOptionalDefaultsWithRelations } from './SalesChannelMappingSchema'

/////////////////////////////////////////
// TICKET TYPE SCHEMA
/////////////////////////////////////////

export const TicketTypeSchema = z.object({
  saleUnit: SaleUnitSchema,
  /**
   * Vincolo di ruolo del titolo. Incompatibile con `consumesRoleQuota = false` (§4.7).
   */
  roleConstraint: DanceRoleSchema.nullish(),
  visibility: TicketTypeVisibilitySchema,
  id: z.number().int(),
  eventId: z.number().int(),
  /**
   * I18nText { it, en? }
   */
  name: JsonValueSchema,
  /**
   * I18nText { it, en? }
   */
  description: JsonValueSchema.nullable(),
  /**
   * Centesimi interi (§3.1).
   */
  basePrice: z.number().int(),
  consumesRoleQuota: z.boolean(),
  saleOpensAt: z.coerce.date().nullish(),
  saleClosesAt: z.coerce.date().nullish(),
  accessCode: z.string().nullish(),
  minPerOrder: z.number().int(),
  maxPerOrder: z.number().int(),
  indicatedLevel: z.string().nullish(),
  highlighted: z.boolean(),
  sortOrder: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type TicketType = z.infer<typeof TicketTypeSchema>

/////////////////////////////////////////
// TICKET TYPE PARTIAL SCHEMA
/////////////////////////////////////////

export const TicketTypePartialSchema = TicketTypeSchema.partial()

export type TicketTypePartial = z.infer<typeof TicketTypePartialSchema>

/////////////////////////////////////////
// TICKET TYPE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const TicketTypeOptionalDefaultsSchema = TicketTypeSchema.merge(z.object({
  saleUnit: SaleUnitSchema.optional(),
  visibility: TicketTypeVisibilitySchema.optional(),
  id: z.number().int().optional(),
  /**
   * Centesimi interi (§3.1).
   */
  basePrice: z.number().int().optional(),
  consumesRoleQuota: z.boolean().optional(),
  minPerOrder: z.number().int().optional(),
  maxPerOrder: z.number().int().optional(),
  highlighted: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type TicketTypeOptionalDefaults = z.infer<typeof TicketTypeOptionalDefaultsSchema>

/////////////////////////////////////////
// TICKET TYPE RELATION SCHEMA
/////////////////////////////////////////

export type TicketTypeRelations = {
  event: EventWithRelations;
  sessions: TicketTypeSessionWithRelations[];
  priceTiers: PriceTierWithRelations[];
  orderLines: OrderLineWithRelations[];
  passIssuances: PassIssuanceWithRelations[];
  tickets: TicketWithRelations[];
  channelMappings: SalesChannelMappingWithRelations[];
};

export type TicketTypeWithRelations = Omit<z.infer<typeof TicketTypeSchema>, "description"> & {
  description?: JsonValueType | null;
} & TicketTypeRelations

export const TicketTypeWithRelationsSchema: z.ZodType<TicketTypeWithRelations> = TicketTypeSchema.merge(z.object({
  event: z.lazy(() => EventWithRelationsSchema),
  sessions: z.lazy(() => TicketTypeSessionWithRelationsSchema).array(),
  priceTiers: z.lazy(() => PriceTierWithRelationsSchema).array(),
  orderLines: z.lazy(() => OrderLineWithRelationsSchema).array(),
  passIssuances: z.lazy(() => PassIssuanceWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketWithRelationsSchema).array(),
  channelMappings: z.lazy(() => SalesChannelMappingWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// TICKET TYPE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type TicketTypeOptionalDefaultsRelations = {
  event: EventOptionalDefaultsWithRelations;
  sessions: TicketTypeSessionOptionalDefaultsWithRelations[];
  priceTiers: PriceTierOptionalDefaultsWithRelations[];
  orderLines: OrderLineOptionalDefaultsWithRelations[];
  passIssuances: PassIssuanceOptionalDefaultsWithRelations[];
  tickets: TicketOptionalDefaultsWithRelations[];
  channelMappings: SalesChannelMappingOptionalDefaultsWithRelations[];
};

export type TicketTypeOptionalDefaultsWithRelations = Omit<z.infer<typeof TicketTypeOptionalDefaultsSchema>, "description"> & {
  description?: JsonValueType | null;
} & TicketTypeOptionalDefaultsRelations

export const TicketTypeOptionalDefaultsWithRelationsSchema: z.ZodType<TicketTypeOptionalDefaultsWithRelations> = TicketTypeOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  sessions: z.lazy(() => TicketTypeSessionOptionalDefaultsWithRelationsSchema).array(),
  priceTiers: z.lazy(() => PriceTierOptionalDefaultsWithRelationsSchema).array(),
  orderLines: z.lazy(() => OrderLineOptionalDefaultsWithRelationsSchema).array(),
  passIssuances: z.lazy(() => PassIssuanceOptionalDefaultsWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketOptionalDefaultsWithRelationsSchema).array(),
  channelMappings: z.lazy(() => SalesChannelMappingOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// TICKET TYPE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type TicketTypePartialRelations = {
  event?: EventPartialWithRelations;
  sessions?: TicketTypeSessionPartialWithRelations[];
  priceTiers?: PriceTierPartialWithRelations[];
  orderLines?: OrderLinePartialWithRelations[];
  passIssuances?: PassIssuancePartialWithRelations[];
  tickets?: TicketPartialWithRelations[];
  channelMappings?: SalesChannelMappingPartialWithRelations[];
};

export type TicketTypePartialWithRelations = Omit<z.infer<typeof TicketTypePartialSchema>, "description"> & {
  description?: JsonValueType | null;
} & TicketTypePartialRelations

export const TicketTypePartialWithRelationsSchema: z.ZodType<TicketTypePartialWithRelations> = TicketTypePartialSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  sessions: z.lazy(() => TicketTypeSessionPartialWithRelationsSchema).array(),
  priceTiers: z.lazy(() => PriceTierPartialWithRelationsSchema).array(),
  orderLines: z.lazy(() => OrderLinePartialWithRelationsSchema).array(),
  passIssuances: z.lazy(() => PassIssuancePartialWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
  channelMappings: z.lazy(() => SalesChannelMappingPartialWithRelationsSchema).array(),
})).partial()

export type TicketTypeOptionalDefaultsWithPartialRelations = Omit<z.infer<typeof TicketTypeOptionalDefaultsSchema>, "description"> & {
  description?: JsonValueType | null;
} & TicketTypePartialRelations

export const TicketTypeOptionalDefaultsWithPartialRelationsSchema: z.ZodType<TicketTypeOptionalDefaultsWithPartialRelations> = TicketTypeOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  sessions: z.lazy(() => TicketTypeSessionPartialWithRelationsSchema).array(),
  priceTiers: z.lazy(() => PriceTierPartialWithRelationsSchema).array(),
  orderLines: z.lazy(() => OrderLinePartialWithRelationsSchema).array(),
  passIssuances: z.lazy(() => PassIssuancePartialWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
  channelMappings: z.lazy(() => SalesChannelMappingPartialWithRelationsSchema).array(),
}).partial())

export type TicketTypeWithPartialRelations = Omit<z.infer<typeof TicketTypeSchema>, "description"> & {
  description?: JsonValueType | null;
} & TicketTypePartialRelations

export const TicketTypeWithPartialRelationsSchema: z.ZodType<TicketTypeWithPartialRelations> = TicketTypeSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  sessions: z.lazy(() => TicketTypeSessionPartialWithRelationsSchema).array(),
  priceTiers: z.lazy(() => PriceTierPartialWithRelationsSchema).array(),
  orderLines: z.lazy(() => OrderLinePartialWithRelationsSchema).array(),
  passIssuances: z.lazy(() => PassIssuancePartialWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
  channelMappings: z.lazy(() => SalesChannelMappingPartialWithRelationsSchema).array(),
}).partial())

export default TicketTypeSchema;
