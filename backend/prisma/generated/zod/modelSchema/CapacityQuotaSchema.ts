import { z } from 'zod';
import { QuotaScopeSchema } from '../inputTypeSchemas/QuotaScopeSchema'
import { DanceRoleSchema } from '../inputTypeSchemas/DanceRoleSchema'
import { QuotaReservedForSchema } from '../inputTypeSchemas/QuotaReservedForSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { QuotaConsumptionWithRelationsSchema, QuotaConsumptionPartialWithRelationsSchema, QuotaConsumptionOptionalDefaultsWithRelationsSchema } from './QuotaConsumptionSchema'
import type { QuotaConsumptionWithRelations, QuotaConsumptionPartialWithRelations, QuotaConsumptionOptionalDefaultsWithRelations } from './QuotaConsumptionSchema'

/////////////////////////////////////////
// CAPACITY QUOTA SCHEMA
/////////////////////////////////////////

/**
 * Ogni vincolo di capienza è una RIGA DI CONFIGURAZIONE, non un campo sparso su
 * evento e titolo: capienza della sala, equilibrio dei ruoli, inventario
 * commerciale del titolo, capienza di una sala secondaria, impegno con un
 * fornitore. Rende identico il codice che serve una milonga da 120 posti e un
 * encuentro 50+50 con tolleranza (`05` §1).
 * 
 * `consumed` è un CAMPO CALCOLATO DAL SERVER (§5): nessun DTO di scrittura lo
 * accetta, si muove solo attraverso `CapacityEngineService`.
 */
export const CapacityQuotaSchema = z.object({
  scope: QuotaScopeSchema,
  /**
   * Nullo = quota totale, indifferente al ruolo. Valorizzabile SOLO su
   * `scope ∈ {EVENT, SESSION}`: le quote di titolo e di servizio sono per
   * persona, indipendentemente da come balla.
   */
  role: DanceRoleSchema.nullish(),
  /**
   * Quota sottratta alla vendita online e non esposta nella disponibilità
   * pubblica: omaggi (`COMPLIMENTARY`) e biglietteria dell'organizzatore
   * (`EXTERNAL_CHANNEL`).
   */
  reservedFor: QuotaReservedForSchema.nullish(),
  id: z.number().int(),
  eventId: z.number().int(),
  /**
   * Riferimento POLIMORFO SENZA CHIAVE ESTERNA: punta a `Session`,
   * `TicketType` o `EventService` secondo `scope` (§4.8). La coerenza è
   * verificata dal servizio, non dal database.
   */
  scopeId: z.number().int().nullish(),
  /**
   * Tetto assoluto.
   */
  limit: z.number().int(),
  /**
   * Contatore denormalizzato, mosso nella stessa transazione dei consumi con
   * l'AGGIORNAMENTO CONDIZIONATO del §4.8. Mai scritto dal client.
   */
  consumed: z.number().int(),
  /**
   * Se falso la quota CONTA i posti ma NON BLOCCA la vendita (`05` §3): è il
   * caso delle milonghe incluse in un pass, dove non esiste un posto
   * assegnato e la sala assorbe.
   */
  limiting: z.boolean(),
  /**
   * Valorizzato solo sulle quote di ruolo appaiate del medesimo ambito.
   * Nullo = nessun cancello. NON estende il limite: restringe dinamicamente
   * l'accesso al ruolo sovrarappresentato (`05` §6).
   */
  imbalanceTolerance: z.number().int().nullish(),
  /**
   * Posti accettabili oltre il limite senza rifiutare l'ordine.
   * FORZATO A 0 E NON MODIFICABILE sulla capienza della sala
   * (`scope=EVENT, role=null`) e sulle quote di ruolo di ambito `EVENT`:
   * non è un limite commerciale, è un vincolo di sicurezza (`05` §5.1).
   */
  overbookAllowance: z.number().int(),
  /**
   * Se falso la disponibilità residua non compare in scheda evento.
   */
  publiclyVisible: z.boolean(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type CapacityQuota = z.infer<typeof CapacityQuotaSchema>

/////////////////////////////////////////
// CAPACITY QUOTA PARTIAL SCHEMA
/////////////////////////////////////////

export const CapacityQuotaPartialSchema = CapacityQuotaSchema.partial()

export type CapacityQuotaPartial = z.infer<typeof CapacityQuotaPartialSchema>

/////////////////////////////////////////
// CAPACITY QUOTA OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const CapacityQuotaOptionalDefaultsSchema = CapacityQuotaSchema.merge(z.object({
  id: z.number().int().optional(),
  /**
   * Contatore denormalizzato, mosso nella stessa transazione dei consumi con
   * l'AGGIORNAMENTO CONDIZIONATO del §4.8. Mai scritto dal client.
   */
  consumed: z.number().int().optional(),
  /**
   * Se falso la quota CONTA i posti ma NON BLOCCA la vendita (`05` §3): è il
   * caso delle milonghe incluse in un pass, dove non esiste un posto
   * assegnato e la sala assorbe.
   */
  limiting: z.boolean().optional(),
  /**
   * Posti accettabili oltre il limite senza rifiutare l'ordine.
   * FORZATO A 0 E NON MODIFICABILE sulla capienza della sala
   * (`scope=EVENT, role=null`) e sulle quote di ruolo di ambito `EVENT`:
   * non è un limite commerciale, è un vincolo di sicurezza (`05` §5.1).
   */
  overbookAllowance: z.number().int().optional(),
  /**
   * Se falso la disponibilità residua non compare in scheda evento.
   */
  publiclyVisible: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type CapacityQuotaOptionalDefaults = z.infer<typeof CapacityQuotaOptionalDefaultsSchema>

/////////////////////////////////////////
// CAPACITY QUOTA RELATION SCHEMA
/////////////////////////////////////////

export type CapacityQuotaRelations = {
  event: EventWithRelations;
  consumptions: QuotaConsumptionWithRelations[];
};

export type CapacityQuotaWithRelations = z.infer<typeof CapacityQuotaSchema> & CapacityQuotaRelations

export const CapacityQuotaWithRelationsSchema: z.ZodType<CapacityQuotaWithRelations> = CapacityQuotaSchema.merge(z.object({
  event: z.lazy(() => EventWithRelationsSchema),
  consumptions: z.lazy(() => QuotaConsumptionWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// CAPACITY QUOTA OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type CapacityQuotaOptionalDefaultsRelations = {
  event: EventOptionalDefaultsWithRelations;
  consumptions: QuotaConsumptionOptionalDefaultsWithRelations[];
};

export type CapacityQuotaOptionalDefaultsWithRelations = z.infer<typeof CapacityQuotaOptionalDefaultsSchema> & CapacityQuotaOptionalDefaultsRelations

export const CapacityQuotaOptionalDefaultsWithRelationsSchema: z.ZodType<CapacityQuotaOptionalDefaultsWithRelations> = CapacityQuotaOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  consumptions: z.lazy(() => QuotaConsumptionOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// CAPACITY QUOTA PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type CapacityQuotaPartialRelations = {
  event?: EventPartialWithRelations;
  consumptions?: QuotaConsumptionPartialWithRelations[];
};

export type CapacityQuotaPartialWithRelations = z.infer<typeof CapacityQuotaPartialSchema> & CapacityQuotaPartialRelations

export const CapacityQuotaPartialWithRelationsSchema: z.ZodType<CapacityQuotaPartialWithRelations> = CapacityQuotaPartialSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  consumptions: z.lazy(() => QuotaConsumptionPartialWithRelationsSchema).array(),
})).partial()

export type CapacityQuotaOptionalDefaultsWithPartialRelations = z.infer<typeof CapacityQuotaOptionalDefaultsSchema> & CapacityQuotaPartialRelations

export const CapacityQuotaOptionalDefaultsWithPartialRelationsSchema: z.ZodType<CapacityQuotaOptionalDefaultsWithPartialRelations> = CapacityQuotaOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  consumptions: z.lazy(() => QuotaConsumptionPartialWithRelationsSchema).array(),
}).partial())

export type CapacityQuotaWithPartialRelations = z.infer<typeof CapacityQuotaSchema> & CapacityQuotaPartialRelations

export const CapacityQuotaWithPartialRelationsSchema: z.ZodType<CapacityQuotaWithPartialRelations> = CapacityQuotaSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  consumptions: z.lazy(() => QuotaConsumptionPartialWithRelationsSchema).array(),
}).partial())

export default CapacityQuotaSchema;
