import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { OrderWithRelationsSchema, OrderPartialWithRelationsSchema, OrderOptionalDefaultsWithRelationsSchema } from './OrderSchema'
import type { OrderWithRelations, OrderPartialWithRelations, OrderOptionalDefaultsWithRelations } from './OrderSchema'
import { TicketTypeWithRelationsSchema, TicketTypePartialWithRelationsSchema, TicketTypeOptionalDefaultsWithRelationsSchema } from './TicketTypeSchema'
import type { TicketTypeWithRelations, TicketTypePartialWithRelations, TicketTypeOptionalDefaultsWithRelations } from './TicketTypeSchema'
import { EventServiceWithRelationsSchema, EventServicePartialWithRelationsSchema, EventServiceOptionalDefaultsWithRelationsSchema } from './EventServiceSchema'
import type { EventServiceWithRelations, EventServicePartialWithRelations, EventServiceOptionalDefaultsWithRelations } from './EventServiceSchema'
import { PriceTierWithRelationsSchema, PriceTierPartialWithRelationsSchema, PriceTierOptionalDefaultsWithRelationsSchema } from './PriceTierSchema'
import type { PriceTierWithRelations, PriceTierPartialWithRelations, PriceTierOptionalDefaultsWithRelations } from './PriceTierSchema'
import { TicketWithRelationsSchema, TicketPartialWithRelationsSchema, TicketOptionalDefaultsWithRelationsSchema } from './TicketSchema'
import type { TicketWithRelations, TicketPartialWithRelations, TicketOptionalDefaultsWithRelations } from './TicketSchema'

/////////////////////////////////////////
// ORDER LINE SCHEMA
/////////////////////////////////////////

/**
 * Guscio della fase D2 (§4.11). Figlio posseduto: `Cascade` da `Order`, nessun
 * controller proprio (`PATCH /orders/:id/lines`).
 */
export const OrderLineSchema = z.object({
  id: z.number().int(),
  orderId: z.number().int(),
  ticketTypeId: z.number().int().nullish(),
  eventServiceId: z.number().int().nullish(),
  quantity: z.number().int(),
  /**
   * Centesimi interi, calcolati dal server: un prezzo che arriva dal client è
   * un difetto di sicurezza (§4.11).
   */
  unitPrice: z.number().int(),
  presaleRightsPerUnit: z.number().int(),
  lineTotal: z.number().int(),
  priceTierId: z.number().int().nullish(),
  /**
   * `[{ name, surname, email, declaredRole, serviceAttributes }]`.
   * `serviceAttributes` può contenere diete e allergie: accesso ristretto,
   * mai nelle esportazioni generiche né nella vista di check-in (`RB12`).
   */
  attendees: JsonValueSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type OrderLine = z.infer<typeof OrderLineSchema>

/////////////////////////////////////////
// ORDER LINE PARTIAL SCHEMA
/////////////////////////////////////////

export const OrderLinePartialSchema = OrderLineSchema.partial()

export type OrderLinePartial = z.infer<typeof OrderLinePartialSchema>

/////////////////////////////////////////
// ORDER LINE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const OrderLineOptionalDefaultsSchema = OrderLineSchema.merge(z.object({
  id: z.number().int().optional(),
  quantity: z.number().int().optional(),
  /**
   * Centesimi interi, calcolati dal server: un prezzo che arriva dal client è
   * un difetto di sicurezza (§4.11).
   */
  unitPrice: z.number().int().optional(),
  presaleRightsPerUnit: z.number().int().optional(),
  lineTotal: z.number().int().optional(),
  /**
   * `[{ name, surname, email, declaredRole, serviceAttributes }]`.
   * `serviceAttributes` può contenere diete e allergie: accesso ristretto,
   * mai nelle esportazioni generiche né nella vista di check-in (`RB12`).
   */
  attendees: JsonValueSchema,
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type OrderLineOptionalDefaults = z.infer<typeof OrderLineOptionalDefaultsSchema>

/////////////////////////////////////////
// ORDER LINE RELATION SCHEMA
/////////////////////////////////////////

export type OrderLineRelations = {
  order: OrderWithRelations;
  ticketType?: TicketTypeWithRelations | null;
  eventService?: EventServiceWithRelations | null;
  priceTier?: PriceTierWithRelations | null;
  tickets: TicketWithRelations[];
};

export type OrderLineWithRelations = z.infer<typeof OrderLineSchema> & OrderLineRelations

export const OrderLineWithRelationsSchema: z.ZodType<OrderLineWithRelations> = OrderLineSchema.merge(z.object({
  order: z.lazy(() => OrderWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypeWithRelationsSchema).nullish(),
  eventService: z.lazy(() => EventServiceWithRelationsSchema).nullish(),
  priceTier: z.lazy(() => PriceTierWithRelationsSchema).nullish(),
  tickets: z.lazy(() => TicketWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ORDER LINE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type OrderLineOptionalDefaultsRelations = {
  order: OrderOptionalDefaultsWithRelations;
  ticketType?: TicketTypeOptionalDefaultsWithRelations | null;
  eventService?: EventServiceOptionalDefaultsWithRelations | null;
  priceTier?: PriceTierOptionalDefaultsWithRelations | null;
  tickets: TicketOptionalDefaultsWithRelations[];
};

export type OrderLineOptionalDefaultsWithRelations = z.infer<typeof OrderLineOptionalDefaultsSchema> & OrderLineOptionalDefaultsRelations

export const OrderLineOptionalDefaultsWithRelationsSchema: z.ZodType<OrderLineOptionalDefaultsWithRelations> = OrderLineOptionalDefaultsSchema.merge(z.object({
  order: z.lazy(() => OrderOptionalDefaultsWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypeOptionalDefaultsWithRelationsSchema).nullish(),
  eventService: z.lazy(() => EventServiceOptionalDefaultsWithRelationsSchema).nullish(),
  priceTier: z.lazy(() => PriceTierOptionalDefaultsWithRelationsSchema).nullish(),
  tickets: z.lazy(() => TicketOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ORDER LINE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type OrderLinePartialRelations = {
  order?: OrderPartialWithRelations;
  ticketType?: TicketTypePartialWithRelations | null;
  eventService?: EventServicePartialWithRelations | null;
  priceTier?: PriceTierPartialWithRelations | null;
  tickets?: TicketPartialWithRelations[];
};

export type OrderLinePartialWithRelations = z.infer<typeof OrderLinePartialSchema> & OrderLinePartialRelations

export const OrderLinePartialWithRelationsSchema: z.ZodType<OrderLinePartialWithRelations> = OrderLinePartialSchema.merge(z.object({
  order: z.lazy(() => OrderPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema).nullish(),
  eventService: z.lazy(() => EventServicePartialWithRelationsSchema).nullish(),
  priceTier: z.lazy(() => PriceTierPartialWithRelationsSchema).nullish(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
})).partial()

export type OrderLineOptionalDefaultsWithPartialRelations = z.infer<typeof OrderLineOptionalDefaultsSchema> & OrderLinePartialRelations

export const OrderLineOptionalDefaultsWithPartialRelationsSchema: z.ZodType<OrderLineOptionalDefaultsWithPartialRelations> = OrderLineOptionalDefaultsSchema.merge(z.object({
  order: z.lazy(() => OrderPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema).nullish(),
  eventService: z.lazy(() => EventServicePartialWithRelationsSchema).nullish(),
  priceTier: z.lazy(() => PriceTierPartialWithRelationsSchema).nullish(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
}).partial())

export type OrderLineWithPartialRelations = z.infer<typeof OrderLineSchema> & OrderLinePartialRelations

export const OrderLineWithPartialRelationsSchema: z.ZodType<OrderLineWithPartialRelations> = OrderLineSchema.merge(z.object({
  order: z.lazy(() => OrderPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema).nullish(),
  eventService: z.lazy(() => EventServicePartialWithRelationsSchema).nullish(),
  priceTier: z.lazy(() => PriceTierPartialWithRelationsSchema).nullish(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
}).partial())

export default OrderLineSchema;
