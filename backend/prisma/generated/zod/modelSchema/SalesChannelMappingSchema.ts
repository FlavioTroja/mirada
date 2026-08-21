import { z } from 'zod';
import { SalesChannelWithRelationsSchema, SalesChannelPartialWithRelationsSchema, SalesChannelOptionalDefaultsWithRelationsSchema } from './SalesChannelSchema'
import type { SalesChannelWithRelations, SalesChannelPartialWithRelations, SalesChannelOptionalDefaultsWithRelations } from './SalesChannelSchema'
import { TicketTypeWithRelationsSchema, TicketTypePartialWithRelationsSchema, TicketTypeOptionalDefaultsWithRelationsSchema } from './TicketTypeSchema'
import type { TicketTypeWithRelations, TicketTypePartialWithRelations, TicketTypeOptionalDefaultsWithRelations } from './TicketTypeSchema'

/////////////////////////////////////////
// SALES CHANNEL MAPPING SCHEMA
/////////////////////////////////////////

/**
 * La traduzione: prodotto del negozio → titolo d'ingresso di Mirada.
 * 
 * ── `externalVariantId` è `""`, non `NULL` ──────────────────────────────────
 * In PostgreSQL un indice univoco tratta ogni `NULL` come distinto: con la
 * variante nullable si potrebbero creare **due** mappature «qualunque variante»
 * per lo stesso prodotto, e la risoluzione diventerebbe casuale. La stringa
 * vuota significa «qualunque variante» ed è un valore come gli altri, quindi il
 * vincolo di unicità funziona davvero.
 * 
 * La risoluzione prova prima la variante esatta, poi il ripiego su `""`.
 */
export const SalesChannelMappingSchema = z.object({
  id: z.number().int(),
  salesChannelId: z.number().int(),
  externalProductId: z.string(),
  /**
   * `""` = qualunque variante del prodotto. Vedi la nota sopra.
   */
  externalVariantId: z.string(),
  /**
   * **Nullo di proposito**: una mappatura senza titolo significa «questo
   * articolo non è un biglietto, ignoralo». Serve al caso normale del negozio
   * che vende anche magliette e libri: senza, un ordine misto finirebbe in
   * quarantena a ogni acquisto, e la quarantena smetterebbe di voler dire
   * «qualcosa non va».
   * 
   * La distinzione che conta è fra **nessuna mappatura** — non so cosa sia,
   * quarantena — e **mappatura senza titolo** — so cos'è, non è un biglietto.
   */
  ticketTypeId: z.number().int().nullish(),
  /**
   * Quanti posti vale una unità di questo prodotto. Un «pacchetto coppia»
   * venduto come un articolo solo ne vale due, e senza questo campo entrerebbe
   * in sala una persona sola con due biglietti in tasca.
   */
  seatsPerUnit: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type SalesChannelMapping = z.infer<typeof SalesChannelMappingSchema>

/////////////////////////////////////////
// SALES CHANNEL MAPPING PARTIAL SCHEMA
/////////////////////////////////////////

export const SalesChannelMappingPartialSchema = SalesChannelMappingSchema.partial()

export type SalesChannelMappingPartial = z.infer<typeof SalesChannelMappingPartialSchema>

/////////////////////////////////////////
// SALES CHANNEL MAPPING OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const SalesChannelMappingOptionalDefaultsSchema = SalesChannelMappingSchema.merge(z.object({
  id: z.number().int().optional(),
  /**
   * `""` = qualunque variante del prodotto. Vedi la nota sopra.
   */
  externalVariantId: z.string().optional(),
  /**
   * Quanti posti vale una unità di questo prodotto. Un «pacchetto coppia»
   * venduto come un articolo solo ne vale due, e senza questo campo entrerebbe
   * in sala una persona sola con due biglietti in tasca.
   */
  seatsPerUnit: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type SalesChannelMappingOptionalDefaults = z.infer<typeof SalesChannelMappingOptionalDefaultsSchema>

/////////////////////////////////////////
// SALES CHANNEL MAPPING RELATION SCHEMA
/////////////////////////////////////////

export type SalesChannelMappingRelations = {
  salesChannel: SalesChannelWithRelations;
  ticketType?: TicketTypeWithRelations | null;
};

export type SalesChannelMappingWithRelations = z.infer<typeof SalesChannelMappingSchema> & SalesChannelMappingRelations

export const SalesChannelMappingWithRelationsSchema: z.ZodType<SalesChannelMappingWithRelations> = SalesChannelMappingSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypeWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// SALES CHANNEL MAPPING OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type SalesChannelMappingOptionalDefaultsRelations = {
  salesChannel: SalesChannelOptionalDefaultsWithRelations;
  ticketType?: TicketTypeOptionalDefaultsWithRelations | null;
};

export type SalesChannelMappingOptionalDefaultsWithRelations = z.infer<typeof SalesChannelMappingOptionalDefaultsSchema> & SalesChannelMappingOptionalDefaultsRelations

export const SalesChannelMappingOptionalDefaultsWithRelationsSchema: z.ZodType<SalesChannelMappingOptionalDefaultsWithRelations> = SalesChannelMappingOptionalDefaultsSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelOptionalDefaultsWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypeOptionalDefaultsWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// SALES CHANNEL MAPPING PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type SalesChannelMappingPartialRelations = {
  salesChannel?: SalesChannelPartialWithRelations;
  ticketType?: TicketTypePartialWithRelations | null;
};

export type SalesChannelMappingPartialWithRelations = z.infer<typeof SalesChannelMappingPartialSchema> & SalesChannelMappingPartialRelations

export const SalesChannelMappingPartialWithRelationsSchema: z.ZodType<SalesChannelMappingPartialWithRelations> = SalesChannelMappingPartialSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema).nullish(),
})).partial()

export type SalesChannelMappingOptionalDefaultsWithPartialRelations = z.infer<typeof SalesChannelMappingOptionalDefaultsSchema> & SalesChannelMappingPartialRelations

export const SalesChannelMappingOptionalDefaultsWithPartialRelationsSchema: z.ZodType<SalesChannelMappingOptionalDefaultsWithPartialRelations> = SalesChannelMappingOptionalDefaultsSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema).nullish(),
}).partial())

export type SalesChannelMappingWithPartialRelations = z.infer<typeof SalesChannelMappingSchema> & SalesChannelMappingPartialRelations

export const SalesChannelMappingWithPartialRelationsSchema: z.ZodType<SalesChannelMappingWithPartialRelations> = SalesChannelMappingSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema).nullish(),
}).partial())

export default SalesChannelMappingSchema;
