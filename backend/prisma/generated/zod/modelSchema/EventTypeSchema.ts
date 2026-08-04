import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'

/////////////////////////////////////////
// EVENT TYPE SCHEMA
/////////////////////////////////////////

export const EventTypeSchema = z.object({
  id: z.number().int(),
  /**
   * I18nText { it, en? }
   */
  name: JsonValueSchema,
  slug: z.string(),
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

export type EventTypeWithRelations = z.infer<typeof EventTypeSchema> & EventTypeRelations

export const EventTypeWithRelationsSchema: z.ZodType<EventTypeWithRelations> = EventTypeSchema.merge(z.object({
  events: z.lazy(() => EventWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// EVENT TYPE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type EventTypeOptionalDefaultsRelations = {
  events: EventOptionalDefaultsWithRelations[];
};

export type EventTypeOptionalDefaultsWithRelations = z.infer<typeof EventTypeOptionalDefaultsSchema> & EventTypeOptionalDefaultsRelations

export const EventTypeOptionalDefaultsWithRelationsSchema: z.ZodType<EventTypeOptionalDefaultsWithRelations> = EventTypeOptionalDefaultsSchema.merge(z.object({
  events: z.lazy(() => EventOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// EVENT TYPE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type EventTypePartialRelations = {
  events?: EventPartialWithRelations[];
};

export type EventTypePartialWithRelations = z.infer<typeof EventTypePartialSchema> & EventTypePartialRelations

export const EventTypePartialWithRelationsSchema: z.ZodType<EventTypePartialWithRelations> = EventTypePartialSchema.merge(z.object({
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
})).partial()

export type EventTypeOptionalDefaultsWithPartialRelations = z.infer<typeof EventTypeOptionalDefaultsSchema> & EventTypePartialRelations

export const EventTypeOptionalDefaultsWithPartialRelationsSchema: z.ZodType<EventTypeOptionalDefaultsWithPartialRelations> = EventTypeOptionalDefaultsSchema.merge(z.object({
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
}).partial())

export type EventTypeWithPartialRelations = z.infer<typeof EventTypeSchema> & EventTypePartialRelations

export const EventTypeWithPartialRelationsSchema: z.ZodType<EventTypeWithPartialRelations> = EventTypeSchema.merge(z.object({
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
}).partial())

export default EventTypeSchema;
