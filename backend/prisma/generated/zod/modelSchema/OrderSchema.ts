import { z } from 'zod';
import { OrderStatusSchema } from '../inputTypeSchemas/OrderStatusSchema'
import { PurchaseWithRelationsSchema, PurchasePartialWithRelationsSchema, PurchaseOptionalDefaultsWithRelationsSchema } from './PurchaseSchema'
import type { PurchaseWithRelations, PurchasePartialWithRelations, PurchaseOptionalDefaultsWithRelations } from './PurchaseSchema'
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { OrderLineWithRelationsSchema, OrderLinePartialWithRelationsSchema, OrderLineOptionalDefaultsWithRelationsSchema } from './OrderLineSchema'
import type { OrderLineWithRelations, OrderLinePartialWithRelations, OrderLineOptionalDefaultsWithRelations } from './OrderLineSchema'
import { ReservationWithRelationsSchema, ReservationPartialWithRelationsSchema, ReservationOptionalDefaultsWithRelationsSchema } from './ReservationSchema'
import type { ReservationWithRelations, ReservationPartialWithRelations, ReservationOptionalDefaultsWithRelations } from './ReservationSchema'
import { PaymentWithRelationsSchema, PaymentPartialWithRelationsSchema, PaymentOptionalDefaultsWithRelationsSchema } from './PaymentSchema'
import type { PaymentWithRelations, PaymentPartialWithRelations, PaymentOptionalDefaultsWithRelations } from './PaymentSchema'

/////////////////////////////////////////
// ORDER SCHEMA
/////////////////////////////////////////

/**
 * Guscio della fase D2 (§4.11). Un ordine per organizzatore (`RF-PAY-34`).
 */
export const OrderSchema = z.object({
  status: OrderStatusSchema,
  id: z.number().int(),
  purchaseId: z.number().int(),
  organizationId: z.number().int(),
  eventId: z.number().int(),
  /**
   * Centesimi interi, tutti calcolati dal server (§4.11).
   */
  subtotal: z.number().int(),
  presaleRights: z.number().int(),
  total: z.number().int(),
  priceLockedAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullish(),
  paidAt: z.coerce.date().nullish(),
  failedAt: z.coerce.date().nullish(),
  cancelledAt: z.coerce.date().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Order = z.infer<typeof OrderSchema>

/////////////////////////////////////////
// ORDER PARTIAL SCHEMA
/////////////////////////////////////////

export const OrderPartialSchema = OrderSchema.partial()

export type OrderPartial = z.infer<typeof OrderPartialSchema>

/////////////////////////////////////////
// ORDER OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const OrderOptionalDefaultsSchema = OrderSchema.merge(z.object({
  status: OrderStatusSchema.optional(),
  id: z.number().int().optional(),
  /**
   * Centesimi interi, tutti calcolati dal server (§4.11).
   */
  subtotal: z.number().int().optional(),
  presaleRights: z.number().int().optional(),
  total: z.number().int().optional(),
  priceLockedAt: z.coerce.date().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type OrderOptionalDefaults = z.infer<typeof OrderOptionalDefaultsSchema>

/////////////////////////////////////////
// ORDER RELATION SCHEMA
/////////////////////////////////////////

export type OrderRelations = {
  purchase: PurchaseWithRelations;
  organization: OrganizationWithRelations;
  event: EventWithRelations;
  lines: OrderLineWithRelations[];
  reservations: ReservationWithRelations[];
  payments: PaymentWithRelations[];
};

export type OrderWithRelations = z.infer<typeof OrderSchema> & OrderRelations

export const OrderWithRelationsSchema: z.ZodType<OrderWithRelations> = OrderSchema.merge(z.object({
  purchase: z.lazy(() => PurchaseWithRelationsSchema),
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  event: z.lazy(() => EventWithRelationsSchema),
  lines: z.lazy(() => OrderLineWithRelationsSchema).array(),
  reservations: z.lazy(() => ReservationWithRelationsSchema).array(),
  payments: z.lazy(() => PaymentWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ORDER OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type OrderOptionalDefaultsRelations = {
  purchase: PurchaseOptionalDefaultsWithRelations;
  organization: OrganizationOptionalDefaultsWithRelations;
  event: EventOptionalDefaultsWithRelations;
  lines: OrderLineOptionalDefaultsWithRelations[];
  reservations: ReservationOptionalDefaultsWithRelations[];
  payments: PaymentOptionalDefaultsWithRelations[];
};

export type OrderOptionalDefaultsWithRelations = z.infer<typeof OrderOptionalDefaultsSchema> & OrderOptionalDefaultsRelations

export const OrderOptionalDefaultsWithRelationsSchema: z.ZodType<OrderOptionalDefaultsWithRelations> = OrderOptionalDefaultsSchema.merge(z.object({
  purchase: z.lazy(() => PurchaseOptionalDefaultsWithRelationsSchema),
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  lines: z.lazy(() => OrderLineOptionalDefaultsWithRelationsSchema).array(),
  reservations: z.lazy(() => ReservationOptionalDefaultsWithRelationsSchema).array(),
  payments: z.lazy(() => PaymentOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// ORDER PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type OrderPartialRelations = {
  purchase?: PurchasePartialWithRelations;
  organization?: OrganizationPartialWithRelations;
  event?: EventPartialWithRelations;
  lines?: OrderLinePartialWithRelations[];
  reservations?: ReservationPartialWithRelations[];
  payments?: PaymentPartialWithRelations[];
};

export type OrderPartialWithRelations = z.infer<typeof OrderPartialSchema> & OrderPartialRelations

export const OrderPartialWithRelationsSchema: z.ZodType<OrderPartialWithRelations> = OrderPartialSchema.merge(z.object({
  purchase: z.lazy(() => PurchasePartialWithRelationsSchema),
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema),
  lines: z.lazy(() => OrderLinePartialWithRelationsSchema).array(),
  reservations: z.lazy(() => ReservationPartialWithRelationsSchema).array(),
  payments: z.lazy(() => PaymentPartialWithRelationsSchema).array(),
})).partial()

export type OrderOptionalDefaultsWithPartialRelations = z.infer<typeof OrderOptionalDefaultsSchema> & OrderPartialRelations

export const OrderOptionalDefaultsWithPartialRelationsSchema: z.ZodType<OrderOptionalDefaultsWithPartialRelations> = OrderOptionalDefaultsSchema.merge(z.object({
  purchase: z.lazy(() => PurchasePartialWithRelationsSchema),
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema),
  lines: z.lazy(() => OrderLinePartialWithRelationsSchema).array(),
  reservations: z.lazy(() => ReservationPartialWithRelationsSchema).array(),
  payments: z.lazy(() => PaymentPartialWithRelationsSchema).array(),
}).partial())

export type OrderWithPartialRelations = z.infer<typeof OrderSchema> & OrderPartialRelations

export const OrderWithPartialRelationsSchema: z.ZodType<OrderWithPartialRelations> = OrderSchema.merge(z.object({
  purchase: z.lazy(() => PurchasePartialWithRelationsSchema),
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema),
  lines: z.lazy(() => OrderLinePartialWithRelationsSchema).array(),
  reservations: z.lazy(() => ReservationPartialWithRelationsSchema).array(),
  payments: z.lazy(() => PaymentPartialWithRelationsSchema).array(),
}).partial())

export default OrderSchema;
