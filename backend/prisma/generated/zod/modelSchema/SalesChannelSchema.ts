import { z } from 'zod';
import { SalesChannelProviderSchema } from '../inputTypeSchemas/SalesChannelProviderSchema'
import { SalesChannelStatusSchema } from '../inputTypeSchemas/SalesChannelStatusSchema'
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { SalesChannelMappingWithRelationsSchema, SalesChannelMappingPartialWithRelationsSchema, SalesChannelMappingOptionalDefaultsWithRelationsSchema } from './SalesChannelMappingSchema'
import type { SalesChannelMappingWithRelations, SalesChannelMappingPartialWithRelations, SalesChannelMappingOptionalDefaultsWithRelations } from './SalesChannelMappingSchema'
import { SalesChannelDepositCodeWithRelationsSchema, SalesChannelDepositCodePartialWithRelationsSchema, SalesChannelDepositCodeOptionalDefaultsWithRelationsSchema } from './SalesChannelDepositCodeSchema'
import type { SalesChannelDepositCodeWithRelations, SalesChannelDepositCodePartialWithRelations, SalesChannelDepositCodeOptionalDefaultsWithRelations } from './SalesChannelDepositCodeSchema'
import { ExternalSaleWithRelationsSchema, ExternalSalePartialWithRelationsSchema, ExternalSaleOptionalDefaultsWithRelationsSchema } from './ExternalSaleSchema'
import type { ExternalSaleWithRelations, ExternalSalePartialWithRelations, ExternalSaleOptionalDefaultsWithRelations } from './ExternalSaleSchema'
import { ExternalSaleEventWithRelationsSchema, ExternalSaleEventPartialWithRelationsSchema, ExternalSaleEventOptionalDefaultsWithRelationsSchema } from './ExternalSaleEventSchema'
import type { ExternalSaleEventWithRelations, ExternalSaleEventPartialWithRelations, ExternalSaleEventOptionalDefaultsWithRelations } from './ExternalSaleEventSchema'

/////////////////////////////////////////
// SALES CHANNEL SCHEMA
/////////////////////////////////////////

/**
 * Il negozio esterno collegato a un'organizzazione.
 * 
 * ── Le credenziali sono un JSON cifrato, non tre colonne Shopify ────────────
 * Oggi Trani usa un'app *custom* del proprio negozio: un token statico. Il
 * secondo organizzatore su Shopify richiederà un'app pubblica con OAuth, e il
 * terzo sarà su WooCommerce. Se le credenziali fossero colonne dedicate, ogni
 * prestatore nuovo sarebbe una migrazione; essendo una busta cifrata, è una
 * riga di configurazione. Il contenuto lo interpreta l'adapter del prestatore,
 * che è l'unico che sa cosa significa.
 */
export const SalesChannelSchema = z.object({
  provider: SalesChannelProviderSchema,
  status: SalesChannelStatusSchema,
  id: z.number().int(),
  organizationId: z.number().int(),
  /**
   * Nome dato dall'organizzatore — è ciò che legge nel back-office.
   */
  label: z.string(),
  /**
   * Il segmento in URL del webhook (`/api/sales-channels/webhook/:publicId`).
   * Opaco e generato dal server: l'id numerico in un URL pubblico direbbe a
   * chiunque quanti canali esistono e permetterebbe di provarli a uno a uno.
   */
  publicId: z.string(),
  /**
   * Identificativo del negozio presso il prestatore — per Shopify il dominio
   * `qualcosa.myshopify.com`. Unico per prestatore: lo stesso negozio non può
   * essere collegato a due organizzazioni, che sarebbe il modo di far comparire
   * le vendite di uno nel cruscotto dell'altro.
   */
  externalShopId: z.string(),
  /**
   * Busta cifrata (AES-256-GCM, `@utils/adapters/secretBox`). Mai in chiaro:
   * un token di amministrazione Shopify legge ordini e anagrafiche di TUTTO il
   * negozio, non solo dei biglietti.
   */
  credentials: z.string().nullish(),
  /**
   * Segreto con cui il prestatore firma le notifiche. Cifrato come sopra.
   */
  webhookSecret: z.string(),
  /**
   * Fin dove è arrivata l'ultima passata di riconciliazione. È il `updated_at_min`
   * della chiamata successiva: senza, la riconciliazione rileggerebbe ogni volta
   * tutto lo storico del negozio.
   */
  lastReconciledAt: z.coerce.date().nullish(),
  /**
   * Come si chiama, sul negozio, il campo che porta il **ruolo di ballo**.
   * Il confronto è normalizzato (maiuscole e spazi non contano).
   */
  roleAttributeName: z.string().nullish(),
  /**
   * Come si chiama il campo che porta il **nominativo del partecipante**.
   * Serve agli ordini da più posti, dove altrimenti tutte le iscrizioni
   * nascono intestate a chi ha comprato.
   */
  attendeeNameAttributeName: z.string().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type SalesChannel = z.infer<typeof SalesChannelSchema>

/////////////////////////////////////////
// SALES CHANNEL PARTIAL SCHEMA
/////////////////////////////////////////

export const SalesChannelPartialSchema = SalesChannelSchema.partial()

export type SalesChannelPartial = z.infer<typeof SalesChannelPartialSchema>

/////////////////////////////////////////
// SALES CHANNEL OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const SalesChannelOptionalDefaultsSchema = SalesChannelSchema.merge(z.object({
  status: SalesChannelStatusSchema.optional(),
  id: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type SalesChannelOptionalDefaults = z.infer<typeof SalesChannelOptionalDefaultsSchema>

/////////////////////////////////////////
// SALES CHANNEL RELATION SCHEMA
/////////////////////////////////////////

export type SalesChannelRelations = {
  organization: OrganizationWithRelations;
  mappings: SalesChannelMappingWithRelations[];
  depositCodes: SalesChannelDepositCodeWithRelations[];
  sales: ExternalSaleWithRelations[];
  events: ExternalSaleEventWithRelations[];
};

export type SalesChannelWithRelations = z.infer<typeof SalesChannelSchema> & SalesChannelRelations

export const SalesChannelWithRelationsSchema: z.ZodType<SalesChannelWithRelations> = SalesChannelSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  mappings: z.lazy(() => SalesChannelMappingWithRelationsSchema).array(),
  depositCodes: z.lazy(() => SalesChannelDepositCodeWithRelationsSchema).array(),
  sales: z.lazy(() => ExternalSaleWithRelationsSchema).array(),
  events: z.lazy(() => ExternalSaleEventWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// SALES CHANNEL OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type SalesChannelOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  mappings: SalesChannelMappingOptionalDefaultsWithRelations[];
  depositCodes: SalesChannelDepositCodeOptionalDefaultsWithRelations[];
  sales: ExternalSaleOptionalDefaultsWithRelations[];
  events: ExternalSaleEventOptionalDefaultsWithRelations[];
};

export type SalesChannelOptionalDefaultsWithRelations = z.infer<typeof SalesChannelOptionalDefaultsSchema> & SalesChannelOptionalDefaultsRelations

export const SalesChannelOptionalDefaultsWithRelationsSchema: z.ZodType<SalesChannelOptionalDefaultsWithRelations> = SalesChannelOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  mappings: z.lazy(() => SalesChannelMappingOptionalDefaultsWithRelationsSchema).array(),
  depositCodes: z.lazy(() => SalesChannelDepositCodeOptionalDefaultsWithRelationsSchema).array(),
  sales: z.lazy(() => ExternalSaleOptionalDefaultsWithRelationsSchema).array(),
  events: z.lazy(() => ExternalSaleEventOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// SALES CHANNEL PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type SalesChannelPartialRelations = {
  organization?: OrganizationPartialWithRelations;
  mappings?: SalesChannelMappingPartialWithRelations[];
  depositCodes?: SalesChannelDepositCodePartialWithRelations[];
  sales?: ExternalSalePartialWithRelations[];
  events?: ExternalSaleEventPartialWithRelations[];
};

export type SalesChannelPartialWithRelations = z.infer<typeof SalesChannelPartialSchema> & SalesChannelPartialRelations

export const SalesChannelPartialWithRelationsSchema: z.ZodType<SalesChannelPartialWithRelations> = SalesChannelPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  mappings: z.lazy(() => SalesChannelMappingPartialWithRelationsSchema).array(),
  depositCodes: z.lazy(() => SalesChannelDepositCodePartialWithRelationsSchema).array(),
  sales: z.lazy(() => ExternalSalePartialWithRelationsSchema).array(),
  events: z.lazy(() => ExternalSaleEventPartialWithRelationsSchema).array(),
})).partial()

export type SalesChannelOptionalDefaultsWithPartialRelations = z.infer<typeof SalesChannelOptionalDefaultsSchema> & SalesChannelPartialRelations

export const SalesChannelOptionalDefaultsWithPartialRelationsSchema: z.ZodType<SalesChannelOptionalDefaultsWithPartialRelations> = SalesChannelOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  mappings: z.lazy(() => SalesChannelMappingPartialWithRelationsSchema).array(),
  depositCodes: z.lazy(() => SalesChannelDepositCodePartialWithRelationsSchema).array(),
  sales: z.lazy(() => ExternalSalePartialWithRelationsSchema).array(),
  events: z.lazy(() => ExternalSaleEventPartialWithRelationsSchema).array(),
}).partial())

export type SalesChannelWithPartialRelations = z.infer<typeof SalesChannelSchema> & SalesChannelPartialRelations

export const SalesChannelWithPartialRelationsSchema: z.ZodType<SalesChannelWithPartialRelations> = SalesChannelSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  mappings: z.lazy(() => SalesChannelMappingPartialWithRelationsSchema).array(),
  depositCodes: z.lazy(() => SalesChannelDepositCodePartialWithRelationsSchema).array(),
  sales: z.lazy(() => ExternalSalePartialWithRelationsSchema).array(),
  events: z.lazy(() => ExternalSaleEventPartialWithRelationsSchema).array(),
}).partial())

export default SalesChannelSchema;
