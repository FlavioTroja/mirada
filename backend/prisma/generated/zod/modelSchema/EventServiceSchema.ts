import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import type { JsonValueType } from '../inputTypeSchemas/JsonValueSchema';
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { ServiceTypeWithRelationsSchema, ServiceTypePartialWithRelationsSchema, ServiceTypeOptionalDefaultsWithRelationsSchema } from './ServiceTypeSchema'
import type { ServiceTypeWithRelations, ServiceTypePartialWithRelations, ServiceTypeOptionalDefaultsWithRelations } from './ServiceTypeSchema'

/////////////////////////////////////////
// EVENT SERVICE SCHEMA
/////////////////////////////////////////

export const EventServiceSchema = z.object({
  id: z.number().int(),
  eventId: z.number().int(),
  serviceTypeId: z.number().int(),
  /**
   * I18nText { it, en? }
   */
  name: JsonValueSchema,
  /**
   * I18nText { it, en? }
   */
  description: JsonValueSchema.nullable(),
  /**
   * Centesimi interi (§3.1).
   */
  price: z.number().int(),
  refundCutoffAt: z.coerce.date().nullish(),
  /**
   * Dichiara quali attributi si raccolgono all'acquisto (taglia, dieta, slot).
   * Diete e allergie sono l'unico dato riconducibile alla salute che resta in
   * piattaforma: accesso ristretto, mai nelle esportazioni generiche (§4.6).
   */
  attributesConfig: JsonValueSchema,
  sortOrder: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type EventService = z.infer<typeof EventServiceSchema>

/////////////////////////////////////////
// EVENT SERVICE PARTIAL SCHEMA
/////////////////////////////////////////

export const EventServicePartialSchema = EventServiceSchema.partial()

export type EventServicePartial = z.infer<typeof EventServicePartialSchema>

/////////////////////////////////////////
// EVENT SERVICE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const EventServiceOptionalDefaultsSchema = EventServiceSchema.merge(z.object({
  id: z.number().int().optional(),
  /**
   * Centesimi interi (§3.1).
   */
  price: z.number().int().optional(),
  /**
   * Dichiara quali attributi si raccolgono all'acquisto (taglia, dieta, slot).
   * Diete e allergie sono l'unico dato riconducibile alla salute che resta in
   * piattaforma: accesso ristretto, mai nelle esportazioni generiche (§4.6).
   */
  attributesConfig: JsonValueSchema,
  sortOrder: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type EventServiceOptionalDefaults = z.infer<typeof EventServiceOptionalDefaultsSchema>

/////////////////////////////////////////
// EVENT SERVICE RELATION SCHEMA
/////////////////////////////////////////

export type EventServiceRelations = {
  event: EventWithRelations;
  serviceType: ServiceTypeWithRelations;
};

export type EventServiceWithRelations = Omit<z.infer<typeof EventServiceSchema>, "description"> & {
  description?: JsonValueType | null;
} & EventServiceRelations

export const EventServiceWithRelationsSchema: z.ZodType<EventServiceWithRelations> = EventServiceSchema.merge(z.object({
  event: z.lazy(() => EventWithRelationsSchema),
  serviceType: z.lazy(() => ServiceTypeWithRelationsSchema),
}))

/////////////////////////////////////////
// EVENT SERVICE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type EventServiceOptionalDefaultsRelations = {
  event: EventOptionalDefaultsWithRelations;
  serviceType: ServiceTypeOptionalDefaultsWithRelations;
};

export type EventServiceOptionalDefaultsWithRelations = Omit<z.infer<typeof EventServiceOptionalDefaultsSchema>, "description"> & {
  description?: JsonValueType | null;
} & EventServiceOptionalDefaultsRelations

export const EventServiceOptionalDefaultsWithRelationsSchema: z.ZodType<EventServiceOptionalDefaultsWithRelations> = EventServiceOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  serviceType: z.lazy(() => ServiceTypeOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// EVENT SERVICE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type EventServicePartialRelations = {
  event?: EventPartialWithRelations;
  serviceType?: ServiceTypePartialWithRelations;
};

export type EventServicePartialWithRelations = Omit<z.infer<typeof EventServicePartialSchema>, "description"> & {
  description?: JsonValueType | null;
} & EventServicePartialRelations

export const EventServicePartialWithRelationsSchema: z.ZodType<EventServicePartialWithRelations> = EventServicePartialSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  serviceType: z.lazy(() => ServiceTypePartialWithRelationsSchema),
})).partial()

export type EventServiceOptionalDefaultsWithPartialRelations = Omit<z.infer<typeof EventServiceOptionalDefaultsSchema>, "description"> & {
  description?: JsonValueType | null;
} & EventServicePartialRelations

export const EventServiceOptionalDefaultsWithPartialRelationsSchema: z.ZodType<EventServiceOptionalDefaultsWithPartialRelations> = EventServiceOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  serviceType: z.lazy(() => ServiceTypePartialWithRelationsSchema),
}).partial())

export type EventServiceWithPartialRelations = Omit<z.infer<typeof EventServiceSchema>, "description"> & {
  description?: JsonValueType | null;
} & EventServicePartialRelations

export const EventServiceWithPartialRelationsSchema: z.ZodType<EventServiceWithPartialRelations> = EventServiceSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  serviceType: z.lazy(() => ServiceTypePartialWithRelationsSchema),
}).partial())

export default EventServiceSchema;
