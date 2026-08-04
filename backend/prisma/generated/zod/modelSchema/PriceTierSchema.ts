import { z } from 'zod';
import { PriceTierKindSchema } from '../inputTypeSchemas/PriceTierKindSchema'
import { TicketTypeWithRelationsSchema, TicketTypePartialWithRelationsSchema, TicketTypeOptionalDefaultsWithRelationsSchema } from './TicketTypeSchema'
import type { TicketTypeWithRelations, TicketTypePartialWithRelations, TicketTypeOptionalDefaultsWithRelations } from './TicketTypeSchema'

/////////////////////////////////////////
// PRICE TIER SCHEMA
/////////////////////////////////////////

/**
 * Scaglioni di prezzo. `soldQuantity` è calcolato dal server (§4.7).
 */
export const PriceTierSchema = z.object({
  kind: PriceTierKindSchema,
  id: z.number().int(),
  ticketTypeId: z.number().int(),
  /**
   * Centesimi interi (§3.1).
   */
  price: z.number().int(),
  validUntil: z.coerce.date().nullish(),
  maxQuantity: z.number().int().nullish(),
  soldQuantity: z.number().int(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type PriceTier = z.infer<typeof PriceTierSchema>

/////////////////////////////////////////
// PRICE TIER PARTIAL SCHEMA
/////////////////////////////////////////

export const PriceTierPartialSchema = PriceTierSchema.partial()

export type PriceTierPartial = z.infer<typeof PriceTierPartialSchema>

/////////////////////////////////////////
// PRICE TIER OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PriceTierOptionalDefaultsSchema = PriceTierSchema.merge(z.object({
  id: z.number().int().optional(),
  soldQuantity: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type PriceTierOptionalDefaults = z.infer<typeof PriceTierOptionalDefaultsSchema>

/////////////////////////////////////////
// PRICE TIER RELATION SCHEMA
/////////////////////////////////////////

export type PriceTierRelations = {
  ticketType: TicketTypeWithRelations;
};

export type PriceTierWithRelations = z.infer<typeof PriceTierSchema> & PriceTierRelations

export const PriceTierWithRelationsSchema: z.ZodType<PriceTierWithRelations> = PriceTierSchema.merge(z.object({
  ticketType: z.lazy(() => TicketTypeWithRelationsSchema),
}))

/////////////////////////////////////////
// PRICE TIER OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PriceTierOptionalDefaultsRelations = {
  ticketType: TicketTypeOptionalDefaultsWithRelations;
};

export type PriceTierOptionalDefaultsWithRelations = z.infer<typeof PriceTierOptionalDefaultsSchema> & PriceTierOptionalDefaultsRelations

export const PriceTierOptionalDefaultsWithRelationsSchema: z.ZodType<PriceTierOptionalDefaultsWithRelations> = PriceTierOptionalDefaultsSchema.merge(z.object({
  ticketType: z.lazy(() => TicketTypeOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// PRICE TIER PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PriceTierPartialRelations = {
  ticketType?: TicketTypePartialWithRelations;
};

export type PriceTierPartialWithRelations = z.infer<typeof PriceTierPartialSchema> & PriceTierPartialRelations

export const PriceTierPartialWithRelationsSchema: z.ZodType<PriceTierPartialWithRelations> = PriceTierPartialSchema.merge(z.object({
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
})).partial()

export type PriceTierOptionalDefaultsWithPartialRelations = z.infer<typeof PriceTierOptionalDefaultsSchema> & PriceTierPartialRelations

export const PriceTierOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PriceTierOptionalDefaultsWithPartialRelations> = PriceTierOptionalDefaultsSchema.merge(z.object({
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
}).partial())

export type PriceTierWithPartialRelations = z.infer<typeof PriceTierSchema> & PriceTierPartialRelations

export const PriceTierWithPartialRelationsSchema: z.ZodType<PriceTierWithPartialRelations> = PriceTierSchema.merge(z.object({
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
}).partial())

export default PriceTierSchema;
