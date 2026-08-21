import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { ExternalSaleEventStatusSchema } from '../inputTypeSchemas/ExternalSaleEventStatusSchema'
import { SalesChannelWithRelationsSchema, SalesChannelPartialWithRelationsSchema, SalesChannelOptionalDefaultsWithRelationsSchema } from './SalesChannelSchema'
import type { SalesChannelWithRelations, SalesChannelPartialWithRelations, SalesChannelOptionalDefaultsWithRelations } from './SalesChannelSchema'

/////////////////////////////////////////
// EXTERNAL SALE EVENT SCHEMA
/////////////////////////////////////////

/**
 * Il registro grezzo delle notifiche ricevute.
 * 
 * Sembra un doppione di `ExternalSale` e non lo è: questa tabella registra
 * **ciò che è arrivato**, quella registra **ciò che ne abbiamo capito**. Serve a
 * tre cose che senza di essa non si possono fare: rispondere `200` al prestatore
 * prima di aver elaborato (Shopify stacca a 5 secondi), ritentare ciò che è
 * fallito, e ricostruire cosa è successo quando l'organizzatore dice «io
 * quell'ordine l'ho visto».
 */
export const ExternalSaleEventSchema = z.object({
  status: ExternalSaleEventStatusSchema,
  id: z.number().int(),
  salesChannelId: z.number().int(),
  /**
   * L'identificativo della **consegna** presso il prestatore
   * (`X-Shopify-Webhook-Id`). Unico per canale: la stessa consegna ripetuta non
   * viene rielaborata. Distinto da `externalOrderId`, perché lo stesso ordine
   * genera più notifiche legittime (pagato, poi rimborsato).
   */
  externalEventId: z.string(),
  /**
   * L'argomento presso il prestatore — `orders/paid`, `refunds/create`, …
   */
  topic: z.string(),
  externalOrderId: z.string().nullish(),
  payload: JsonValueSchema,
  /**
   * Il messaggio dell'errore, quando `FAILED`. È ciò che si legge prima di
   * decidere se ritentare o correggere.
   */
  error: z.string().nullish(),
  receivedAt: z.coerce.date(),
  processedAt: z.coerce.date().nullish(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type ExternalSaleEvent = z.infer<typeof ExternalSaleEventSchema>

/////////////////////////////////////////
// EXTERNAL SALE EVENT PARTIAL SCHEMA
/////////////////////////////////////////

export const ExternalSaleEventPartialSchema = ExternalSaleEventSchema.partial()

export type ExternalSaleEventPartial = z.infer<typeof ExternalSaleEventPartialSchema>

/////////////////////////////////////////
// EXTERNAL SALE EVENT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const ExternalSaleEventOptionalDefaultsSchema = ExternalSaleEventSchema.merge(z.object({
  status: ExternalSaleEventStatusSchema.optional(),
  id: z.number().int().optional(),
  receivedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type ExternalSaleEventOptionalDefaults = z.infer<typeof ExternalSaleEventOptionalDefaultsSchema>

/////////////////////////////////////////
// EXTERNAL SALE EVENT RELATION SCHEMA
/////////////////////////////////////////

export type ExternalSaleEventRelations = {
  salesChannel: SalesChannelWithRelations;
};

export type ExternalSaleEventWithRelations = z.infer<typeof ExternalSaleEventSchema> & ExternalSaleEventRelations

export const ExternalSaleEventWithRelationsSchema: z.ZodType<ExternalSaleEventWithRelations> = ExternalSaleEventSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelWithRelationsSchema),
}))

/////////////////////////////////////////
// EXTERNAL SALE EVENT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type ExternalSaleEventOptionalDefaultsRelations = {
  salesChannel: SalesChannelOptionalDefaultsWithRelations;
};

export type ExternalSaleEventOptionalDefaultsWithRelations = z.infer<typeof ExternalSaleEventOptionalDefaultsSchema> & ExternalSaleEventOptionalDefaultsRelations

export const ExternalSaleEventOptionalDefaultsWithRelationsSchema: z.ZodType<ExternalSaleEventOptionalDefaultsWithRelations> = ExternalSaleEventOptionalDefaultsSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// EXTERNAL SALE EVENT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type ExternalSaleEventPartialRelations = {
  salesChannel?: SalesChannelPartialWithRelations;
};

export type ExternalSaleEventPartialWithRelations = z.infer<typeof ExternalSaleEventPartialSchema> & ExternalSaleEventPartialRelations

export const ExternalSaleEventPartialWithRelationsSchema: z.ZodType<ExternalSaleEventPartialWithRelations> = ExternalSaleEventPartialSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
})).partial()

export type ExternalSaleEventOptionalDefaultsWithPartialRelations = z.infer<typeof ExternalSaleEventOptionalDefaultsSchema> & ExternalSaleEventPartialRelations

export const ExternalSaleEventOptionalDefaultsWithPartialRelationsSchema: z.ZodType<ExternalSaleEventOptionalDefaultsWithPartialRelations> = ExternalSaleEventOptionalDefaultsSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
}).partial())

export type ExternalSaleEventWithPartialRelations = z.infer<typeof ExternalSaleEventSchema> & ExternalSaleEventPartialRelations

export const ExternalSaleEventWithPartialRelationsSchema: z.ZodType<ExternalSaleEventWithPartialRelations> = ExternalSaleEventSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
}).partial())

export default ExternalSaleEventSchema;
