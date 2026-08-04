import { z } from 'zod';
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'
import { OrderWithRelationsSchema, OrderPartialWithRelationsSchema, OrderOptionalDefaultsWithRelationsSchema } from './OrderSchema'
import type { OrderWithRelations, OrderPartialWithRelations, OrderOptionalDefaultsWithRelations } from './OrderSchema'

/////////////////////////////////////////
// PURCHASE SCHEMA
/////////////////////////////////////////

/**
 * Guscio della fase D2 (§4.11). Raggruppa N `Order`, uno per organizzatore.
 */
export const PurchaseSchema = z.object({
  id: z.number().int(),
  buyerUserId: z.number().int(),
  /**
   * Centesimi interi (§3.1).
   */
  totalAmount: z.number().int(),
  totalPresaleRights: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Purchase = z.infer<typeof PurchaseSchema>

/////////////////////////////////////////
// PURCHASE PARTIAL SCHEMA
/////////////////////////////////////////

export const PurchasePartialSchema = PurchaseSchema.partial()

export type PurchasePartial = z.infer<typeof PurchasePartialSchema>

/////////////////////////////////////////
// PURCHASE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PurchaseOptionalDefaultsSchema = PurchaseSchema.merge(z.object({
  id: z.number().int().optional(),
  /**
   * Centesimi interi (§3.1).
   */
  totalAmount: z.number().int().optional(),
  totalPresaleRights: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type PurchaseOptionalDefaults = z.infer<typeof PurchaseOptionalDefaultsSchema>

/////////////////////////////////////////
// PURCHASE RELATION SCHEMA
/////////////////////////////////////////

export type PurchaseRelations = {
  buyer: UserWithRelations;
  orders: OrderWithRelations[];
};

export type PurchaseWithRelations = z.infer<typeof PurchaseSchema> & PurchaseRelations

export const PurchaseWithRelationsSchema: z.ZodType<PurchaseWithRelations> = PurchaseSchema.merge(z.object({
  buyer: z.lazy(() => UserWithRelationsSchema),
  orders: z.lazy(() => OrderWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// PURCHASE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PurchaseOptionalDefaultsRelations = {
  buyer: UserOptionalDefaultsWithRelations;
  orders: OrderOptionalDefaultsWithRelations[];
};

export type PurchaseOptionalDefaultsWithRelations = z.infer<typeof PurchaseOptionalDefaultsSchema> & PurchaseOptionalDefaultsRelations

export const PurchaseOptionalDefaultsWithRelationsSchema: z.ZodType<PurchaseOptionalDefaultsWithRelations> = PurchaseOptionalDefaultsSchema.merge(z.object({
  buyer: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
  orders: z.lazy(() => OrderOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// PURCHASE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PurchasePartialRelations = {
  buyer?: UserPartialWithRelations;
  orders?: OrderPartialWithRelations[];
};

export type PurchasePartialWithRelations = z.infer<typeof PurchasePartialSchema> & PurchasePartialRelations

export const PurchasePartialWithRelationsSchema: z.ZodType<PurchasePartialWithRelations> = PurchasePartialSchema.merge(z.object({
  buyer: z.lazy(() => UserPartialWithRelationsSchema),
  orders: z.lazy(() => OrderPartialWithRelationsSchema).array(),
})).partial()

export type PurchaseOptionalDefaultsWithPartialRelations = z.infer<typeof PurchaseOptionalDefaultsSchema> & PurchasePartialRelations

export const PurchaseOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PurchaseOptionalDefaultsWithPartialRelations> = PurchaseOptionalDefaultsSchema.merge(z.object({
  buyer: z.lazy(() => UserPartialWithRelationsSchema),
  orders: z.lazy(() => OrderPartialWithRelationsSchema).array(),
}).partial())

export type PurchaseWithPartialRelations = z.infer<typeof PurchaseSchema> & PurchasePartialRelations

export const PurchaseWithPartialRelationsSchema: z.ZodType<PurchaseWithPartialRelations> = PurchaseSchema.merge(z.object({
  buyer: z.lazy(() => UserPartialWithRelationsSchema),
  orders: z.lazy(() => OrderPartialWithRelationsSchema).array(),
}).partial())

export default PurchaseSchema;
