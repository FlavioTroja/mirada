import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { EventTypeFamilySchema } from '../inputTypeSchemas/EventTypeFamilySchema'
import type { JsonValueType } from '../inputTypeSchemas/JsonValueSchema';
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'

/////////////////////////////////////////
// EVENT TYPE SCHEMA
/////////////////////////////////////////

export const EventTypeSchema = z.object({
  /**
   * In quale lista del back-office compare. Vedi `EventTypeFamily`.
   */
  family: EventTypeFamilySchema,
  id: z.number().int(),
  /**
   * I18nText { it, en? }
   */
  name: JsonValueSchema,
  slug: z.string(),
  /**
   * **Come si chiamano le `Session` di questo tipo**, al plurale.
   * I18nText { it, en? }. Nullo = «Sessioni».
   * 
   * La stessa riga `Session` è «Lezione 3» dentro un corso e «Seminario del
   * sabato» dentro un festival: è giusto che la tabella sia una — check-in,
   * quote e titoli ci girano tutti sopra — ed è sbagliato che lo sia la parola.
   * Cablarla nel codice significa, al terzo tipo evento, sei `@if` da tenere
   * allineati a mano.
   */
  sessionsLabel: JsonValueSchema.nullable(),
  /**
   * Le cinque capacità generano il wizard di creazione evento (§4.1).
   */
  capMultiSession: z.boolean(),
  capRoleQuotas: z.boolean(),
  capLevels: z.boolean(),
  capCast: z.boolean(),
  capCouple: z.boolean(),
  defaultTemplate: JsonValueSchema,
  active: z.boolean(),
  sortOrder: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type EventType = z.infer<typeof EventTypeSchema>

/////////////////////////////////////////
// EVENT TYPE PARTIAL SCHEMA
/////////////////////////////////////////

export const EventTypePartialSchema = EventTypeSchema.partial()

export type EventTypePartial = z.infer<typeof EventTypePartialSchema>

/////////////////////////////////////////
// EVENT TYPE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const EventTypeOptionalDefaultsSchema = EventTypeSchema.merge(z.object({
  /**
   * In quale lista del back-office compare. Vedi `EventTypeFamily`.
   */
  family: EventTypeFamilySchema.optional(),
  id: z.number().int().optional(),
  /**
   * Le cinque capacità generano il wizard di creazione evento (§4.1).
   */
  capMultiSession: z.boolean().optional(),
  capRoleQuotas: z.boolean().optional(),
  capLevels: z.boolean().optional(),
  capCast: z.boolean().optional(),
  capCouple: z.boolean().optional(),
  defaultTemplate: JsonValueSchema,
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type EventTypeOptionalDefaults = z.infer<typeof EventTypeOptionalDefaultsSchema>

/////////////////////////////////////////
// EVENT TYPE RELATION SCHEMA
/////////////////////////////////////////

export type EventTypeRelations = {
  events: EventWithRelations[];
};

export type EventTypeWithRelations = Omit<z.infer<typeof EventTypeSchema>, "sessionsLabel"> & {
  sessionsLabel?: JsonValueType | null;
} & EventTypeRelations

export const EventTypeWithRelationsSchema: z.ZodType<EventTypeWithRelations> = EventTypeSchema.merge(z.object({
  events: z.lazy(() => EventWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// EVENT TYPE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type EventTypeOptionalDefaultsRelations = {
  events: EventOptionalDefaultsWithRelations[];
};

export type EventTypeOptionalDefaultsWithRelations = Omit<z.infer<typeof EventTypeOptionalDefaultsSchema>, "sessionsLabel"> & {
  sessionsLabel?: JsonValueType | null;
} & EventTypeOptionalDefaultsRelations

export const EventTypeOptionalDefaultsWithRelationsSchema: z.ZodType<EventTypeOptionalDefaultsWithRelations> = EventTypeOptionalDefaultsSchema.merge(z.object({
  events: z.lazy(() => EventOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// EVENT TYPE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type EventTypePartialRelations = {
  events?: EventPartialWithRelations[];
};

export type EventTypePartialWithRelations = Omit<z.infer<typeof EventTypePartialSchema>, "sessionsLabel"> & {
  sessionsLabel?: JsonValueType | null;
} & EventTypePartialRelations

export const EventTypePartialWithRelationsSchema: z.ZodType<EventTypePartialWithRelations> = EventTypePartialSchema.merge(z.object({
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
})).partial()

export type EventTypeOptionalDefaultsWithPartialRelations = Omit<z.infer<typeof EventTypeOptionalDefaultsSchema>, "sessionsLabel"> & {
  sessionsLabel?: JsonValueType | null;
} & EventTypePartialRelations

export const EventTypeOptionalDefaultsWithPartialRelationsSchema: z.ZodType<EventTypeOptionalDefaultsWithPartialRelations> = EventTypeOptionalDefaultsSchema.merge(z.object({
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
}).partial())

export type EventTypeWithPartialRelations = Omit<z.infer<typeof EventTypeSchema>, "sessionsLabel"> & {
  sessionsLabel?: JsonValueType | null;
} & EventTypePartialRelations

export const EventTypeWithPartialRelationsSchema: z.ZodType<EventTypeWithPartialRelations> = EventTypeSchema.merge(z.object({
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
}).partial())

export default EventTypeSchema;
