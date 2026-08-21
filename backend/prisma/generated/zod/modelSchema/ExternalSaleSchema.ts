import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { ExternalSaleStatusSchema } from '../inputTypeSchemas/ExternalSaleStatusSchema'
import { SalesChannelWithRelationsSchema, SalesChannelPartialWithRelationsSchema, SalesChannelOptionalDefaultsWithRelationsSchema } from './SalesChannelSchema'
import type { SalesChannelWithRelations, SalesChannelPartialWithRelations, SalesChannelOptionalDefaultsWithRelations } from './SalesChannelSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'
import { TicketWithRelationsSchema, TicketPartialWithRelationsSchema, TicketOptionalDefaultsWithRelationsSchema } from './TicketSchema'
import type { TicketWithRelations, TicketPartialWithRelations, TicketOptionalDefaultsWithRelations } from './TicketSchema'

/////////////////////////////////////////
// EXTERNAL SALE SCHEMA
/////////////////////////////////////////

/**
 * La vendita, nella forma che Mirada capisce.
 * 
 * È il **modello canonico**: qui non c'è nulla di Shopify. L'adapter del
 * prestatore riempie questa riga, e tutto ciò che sta a valle — iscrizioni,
 * capienza, biglietti, WebSocket — non sa da quale negozio sia arrivata. È la
 * stessa forma di `SettlementFact` in `OrderFulfilmentService`, e per la stessa
 * ragione: il giorno di WooCommerce si scrive un adapter, non un percorso.
 */
export const ExternalSaleSchema = z.object({
  status: ExternalSaleStatusSchema,
  id: z.number().int(),
  salesChannelId: z.number().int(),
  /**
   * Risolto dalla mappatura delle righe. **Nullo in quarantena**: se non si sa
   * tradurre il prodotto non si sa nemmeno di quale evento si parli.
   */
  eventId: z.number().int().nullish(),
  /**
   * L'ordine presso il prestatore. Unico per canale: **è l'idempotenza**. La
   * stessa notifica consegnata due volte — cosa che i webhook fanno per
   * progetto — trova un conflitto di chiave invece di emettere altri biglietti.
   */
  externalOrderId: z.string(),
  /**
   * Il numero che l'organizzatore legge sul suo negozio (`#1042`). Serve a lui,
   * non al codice: è come si ritrova un ordine quando qualcuno telefona.
   */
  externalOrderNumber: z.string().nullish(),
  buyerName: z.string(),
  buyerSurname: z.string(),
  buyerEmail: z.string(),
  /**
   * Centesimi interi, come ovunque nel dominio (§3.1). È l'importo incassato
   * **dal negozio**, non da Mirada: serve a riconciliare, non a contabilizzare.
   */
  totalAmount: z.number().int(),
  currency: z.string(),
  /**
   * La vendita nella forma **canonica** — l'esito della traduzione, non il corpo
   * che è arrivato. Il corpo grezzo esiste e sta su `ExternalSaleEvent.payload`:
   * qui serve altro, cioè ciò che `ingest` sa già consumare.
   * 
   * È ciò che rende possibile rielaborare una quarantena dopo aver corretto la
   * mappatura **senza chiedere di nuovo l'ordine al negozio** — e quindi senza
   * dipendere dal fatto che il negozio risponda, che è precisamente ciò su cui
   * non si può contare nel momento in cui serve.
   */
  canonicalPayload: JsonValueSchema,
  /**
   * Perché è in quarantena, in italiano e leggibile: è il testo che
   * l'organizzatore vede accanto al pulsante per rimediare.
   */
  quarantineReason: z.string().nullish(),
  receivedAt: z.coerce.date(),
  ingestedAt: z.coerce.date().nullish(),
  refundedAt: z.coerce.date().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type ExternalSale = z.infer<typeof ExternalSaleSchema>

/////////////////////////////////////////
// EXTERNAL SALE PARTIAL SCHEMA
/////////////////////////////////////////

export const ExternalSalePartialSchema = ExternalSaleSchema.partial()

export type ExternalSalePartial = z.infer<typeof ExternalSalePartialSchema>

/////////////////////////////////////////
// EXTERNAL SALE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const ExternalSaleOptionalDefaultsSchema = ExternalSaleSchema.merge(z.object({
  status: ExternalSaleStatusSchema.optional(),
  id: z.number().int().optional(),
  /**
   * Centesimi interi, come ovunque nel dominio (§3.1). È l'importo incassato
   * **dal negozio**, non da Mirada: serve a riconciliare, non a contabilizzare.
   */
  totalAmount: z.number().int().optional(),
  currency: z.string().optional(),
  receivedAt: z.coerce.date().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type ExternalSaleOptionalDefaults = z.infer<typeof ExternalSaleOptionalDefaultsSchema>

/////////////////////////////////////////
// EXTERNAL SALE RELATION SCHEMA
/////////////////////////////////////////

export type ExternalSaleRelations = {
  salesChannel: SalesChannelWithRelations;
  event?: EventWithRelations | null;
  registrations: RegistrationWithRelations[];
  tickets: TicketWithRelations[];
};

export type ExternalSaleWithRelations = z.infer<typeof ExternalSaleSchema> & ExternalSaleRelations

export const ExternalSaleWithRelationsSchema: z.ZodType<ExternalSaleWithRelations> = ExternalSaleSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelWithRelationsSchema),
  event: z.lazy(() => EventWithRelationsSchema).nullish(),
  registrations: z.lazy(() => RegistrationWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// EXTERNAL SALE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type ExternalSaleOptionalDefaultsRelations = {
  salesChannel: SalesChannelOptionalDefaultsWithRelations;
  event?: EventOptionalDefaultsWithRelations | null;
  registrations: RegistrationOptionalDefaultsWithRelations[];
  tickets: TicketOptionalDefaultsWithRelations[];
};

export type ExternalSaleOptionalDefaultsWithRelations = z.infer<typeof ExternalSaleOptionalDefaultsSchema> & ExternalSaleOptionalDefaultsRelations

export const ExternalSaleOptionalDefaultsWithRelationsSchema: z.ZodType<ExternalSaleOptionalDefaultsWithRelations> = ExternalSaleOptionalDefaultsSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelOptionalDefaultsWithRelationsSchema),
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema).nullish(),
  registrations: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// EXTERNAL SALE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type ExternalSalePartialRelations = {
  salesChannel?: SalesChannelPartialWithRelations;
  event?: EventPartialWithRelations | null;
  registrations?: RegistrationPartialWithRelations[];
  tickets?: TicketPartialWithRelations[];
};

export type ExternalSalePartialWithRelations = z.infer<typeof ExternalSalePartialSchema> & ExternalSalePartialRelations

export const ExternalSalePartialWithRelationsSchema: z.ZodType<ExternalSalePartialWithRelations> = ExternalSalePartialSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema).nullish(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
})).partial()

export type ExternalSaleOptionalDefaultsWithPartialRelations = z.infer<typeof ExternalSaleOptionalDefaultsSchema> & ExternalSalePartialRelations

export const ExternalSaleOptionalDefaultsWithPartialRelationsSchema: z.ZodType<ExternalSaleOptionalDefaultsWithPartialRelations> = ExternalSaleOptionalDefaultsSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema).nullish(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
}).partial())

export type ExternalSaleWithPartialRelations = z.infer<typeof ExternalSaleSchema> & ExternalSalePartialRelations

export const ExternalSaleWithPartialRelationsSchema: z.ZodType<ExternalSaleWithPartialRelations> = ExternalSaleSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema).nullish(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
}).partial())

export default ExternalSaleSchema;
