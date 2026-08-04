import { z } from 'zod';
import { ArtistKindSchema } from '../inputTypeSchemas/ArtistKindSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { ArtistWithRelationsSchema, ArtistPartialWithRelationsSchema, ArtistOptionalDefaultsWithRelationsSchema } from './ArtistSchema'
import type { ArtistWithRelations, ArtistPartialWithRelations, ArtistOptionalDefaultsWithRelations } from './ArtistSchema'

/////////////////////////////////////////
// EVENT CAST SCHEMA
/////////////////////////////////////////

export const EventCastSchema = z.object({
  kind: ArtistKindSchema,
  id: z.number().int(),
  eventId: z.number().int(),
  artistId: z.number().int(),
  sortOrder: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type EventCast = z.infer<typeof EventCastSchema>

/////////////////////////////////////////
// EVENT CAST PARTIAL SCHEMA
/////////////////////////////////////////

export const EventCastPartialSchema = EventCastSchema.partial()

export type EventCastPartial = z.infer<typeof EventCastPartialSchema>

/////////////////////////////////////////
// EVENT CAST OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const EventCastOptionalDefaultsSchema = EventCastSchema.merge(z.object({
  id: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type EventCastOptionalDefaults = z.infer<typeof EventCastOptionalDefaultsSchema>

/////////////////////////////////////////
// EVENT CAST RELATION SCHEMA
/////////////////////////////////////////

export type EventCastRelations = {
  event: EventWithRelations;
  artist: ArtistWithRelations;
};

export type EventCastWithRelations = z.infer<typeof EventCastSchema> & EventCastRelations

export const EventCastWithRelationsSchema: z.ZodType<EventCastWithRelations> = EventCastSchema.merge(z.object({
  event: z.lazy(() => EventWithRelationsSchema),
  artist: z.lazy(() => ArtistWithRelationsSchema),
}))

/////////////////////////////////////////
// EVENT CAST OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type EventCastOptionalDefaultsRelations = {
  event: EventOptionalDefaultsWithRelations;
  artist: ArtistOptionalDefaultsWithRelations;
};

export type EventCastOptionalDefaultsWithRelations = z.infer<typeof EventCastOptionalDefaultsSchema> & EventCastOptionalDefaultsRelations

export const EventCastOptionalDefaultsWithRelationsSchema: z.ZodType<EventCastOptionalDefaultsWithRelations> = EventCastOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  artist: z.lazy(() => ArtistOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// EVENT CAST PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type EventCastPartialRelations = {
  event?: EventPartialWithRelations;
  artist?: ArtistPartialWithRelations;
};

export type EventCastPartialWithRelations = z.infer<typeof EventCastPartialSchema> & EventCastPartialRelations

export const EventCastPartialWithRelationsSchema: z.ZodType<EventCastPartialWithRelations> = EventCastPartialSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  artist: z.lazy(() => ArtistPartialWithRelationsSchema),
})).partial()

export type EventCastOptionalDefaultsWithPartialRelations = z.infer<typeof EventCastOptionalDefaultsSchema> & EventCastPartialRelations

export const EventCastOptionalDefaultsWithPartialRelationsSchema: z.ZodType<EventCastOptionalDefaultsWithPartialRelations> = EventCastOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  artist: z.lazy(() => ArtistPartialWithRelationsSchema),
}).partial())

export type EventCastWithPartialRelations = z.infer<typeof EventCastSchema> & EventCastPartialRelations

export const EventCastWithPartialRelationsSchema: z.ZodType<EventCastWithPartialRelations> = EventCastSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  artist: z.lazy(() => ArtistPartialWithRelationsSchema),
}).partial())

export default EventCastSchema;
