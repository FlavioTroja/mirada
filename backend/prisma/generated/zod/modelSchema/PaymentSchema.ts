import { z } from 'zod';
import { PaymentProviderSchema } from '../inputTypeSchemas/PaymentProviderSchema'
import { PaymentStatusSchema } from '../inputTypeSchemas/PaymentStatusSchema'
import { OrderWithRelationsSchema, OrderPartialWithRelationsSchema, OrderOptionalDefaultsWithRelationsSchema } from './OrderSchema'
import type { OrderWithRelations, OrderPartialWithRelations, OrderOptionalDefaultsWithRelations } from './OrderSchema'

/////////////////////////////////////////
// PAYMENT SCHEMA
/////////////////////////////////////////

/**
 * Guscio della fase D2 (§4.11). `idempotencyKey` unico e `processedEventIds`
 * sono la difesa contro la doppia notifica di Stripe (`RF-PAY-10`).
 */
export const PaymentSchema = z.object({
  provider: PaymentProviderSchema,
  status: PaymentStatusSchema,
  id: z.number().int(),
  orderId: z.number().int(),
  providerPaymentId: z.string(),
  providerAccountId: z.string(),
  /**
   * Centesimi interi (§3.1).
   */
  amount: z.number().int(),
  applicationFeeAmount: z.number().int(),
  idempotencyKey: z.string(),
  processedEventIds: z.string().array(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Payment = z.infer<typeof PaymentSchema>

/////////////////////////////////////////
// PAYMENT PARTIAL SCHEMA
/////////////////////////////////////////

export const PaymentPartialSchema = PaymentSchema.partial()

export type PaymentPartial = z.infer<typeof PaymentPartialSchema>

/////////////////////////////////////////
// PAYMENT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PaymentOptionalDefaultsSchema = PaymentSchema.merge(z.object({
  provider: PaymentProviderSchema.optional(),
  status: PaymentStatusSchema.optional(),
  id: z.number().int().optional(),
  /**
   * Centesimi interi (§3.1).
   */
  amount: z.number().int().optional(),
  applicationFeeAmount: z.number().int().optional(),
  processedEventIds: z.string().array().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type PaymentOptionalDefaults = z.infer<typeof PaymentOptionalDefaultsSchema>

/////////////////////////////////////////
// PAYMENT RELATION SCHEMA
/////////////////////////////////////////

export type PaymentRelations = {
  order: OrderWithRelations;
};

export type PaymentWithRelations = z.infer<typeof PaymentSchema> & PaymentRelations

export const PaymentWithRelationsSchema: z.ZodType<PaymentWithRelations> = PaymentSchema.merge(z.object({
  order: z.lazy(() => OrderWithRelationsSchema),
}))

/////////////////////////////////////////
// PAYMENT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PaymentOptionalDefaultsRelations = {
  order: OrderOptionalDefaultsWithRelations;
};

export type PaymentOptionalDefaultsWithRelations = z.infer<typeof PaymentOptionalDefaultsSchema> & PaymentOptionalDefaultsRelations

export const PaymentOptionalDefaultsWithRelationsSchema: z.ZodType<PaymentOptionalDefaultsWithRelations> = PaymentOptionalDefaultsSchema.merge(z.object({
  order: z.lazy(() => OrderOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// PAYMENT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PaymentPartialRelations = {
  order?: OrderPartialWithRelations;
};

export type PaymentPartialWithRelations = z.infer<typeof PaymentPartialSchema> & PaymentPartialRelations

export const PaymentPartialWithRelationsSchema: z.ZodType<PaymentPartialWithRelations> = PaymentPartialSchema.merge(z.object({
  order: z.lazy(() => OrderPartialWithRelationsSchema),
})).partial()

export type PaymentOptionalDefaultsWithPartialRelations = z.infer<typeof PaymentOptionalDefaultsSchema> & PaymentPartialRelations

export const PaymentOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PaymentOptionalDefaultsWithPartialRelations> = PaymentOptionalDefaultsSchema.merge(z.object({
  order: z.lazy(() => OrderPartialWithRelationsSchema),
}).partial())

export type PaymentWithPartialRelations = z.infer<typeof PaymentSchema> & PaymentPartialRelations

export const PaymentWithPartialRelationsSchema: z.ZodType<PaymentWithPartialRelations> = PaymentSchema.merge(z.object({
  order: z.lazy(() => OrderPartialWithRelationsSchema),
}).partial())

export default PaymentSchema;
