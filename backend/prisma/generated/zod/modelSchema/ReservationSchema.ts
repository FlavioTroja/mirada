import { z } from 'zod';
import { ReleaseReasonSchema } from '../inputTypeSchemas/ReleaseReasonSchema'
import { OrderWithRelationsSchema, OrderPartialWithRelationsSchema, OrderOptionalDefaultsWithRelationsSchema } from './OrderSchema'
import type { OrderWithRelations, OrderPartialWithRelations, OrderOptionalDefaultsWithRelations } from './OrderSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// RESERVATION SCHEMA
/////////////////////////////////////////

/**
 * Guscio della fase D2 (§4.11). Una sola prenotazione attiva per
 * `(userId, eventId)` — indice unico PARZIALE su `releasedAt IS NULL`, creato a
 * mano nella migrazione (`RF-PAY-23`).
 */
export const ReservationSchema = z.object({
  releaseReason: ReleaseReasonSchema.nullish(),
  id: z.number().int(),
  orderId: z.number().int(),
  eventId: z.number().int(),
  userId: z.number().int(),
  expiresAt: z.coerce.date(),
  rearmedAt: z.coerce.date().nullish(),
  releasedAt: z.coerce.date().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Reservation = z.infer<typeof ReservationSchema>

/////////////////////////////////////////
// RESERVATION PARTIAL SCHEMA
/////////////////////////////////////////

export const ReservationPartialSchema = ReservationSchema.partial()

export type ReservationPartial = z.infer<typeof ReservationPartialSchema>

/////////////////////////////////////////
// RESERVATION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const ReservationOptionalDefaultsSchema = ReservationSchema.merge(z.object({
  id: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type ReservationOptionalDefaults = z.infer<typeof ReservationOptionalDefaultsSchema>

/////////////////////////////////////////
// RESERVATION RELATION SCHEMA
/////////////////////////////////////////

export type ReservationRelations = {
  order: OrderWithRelations;
  event: EventWithRelations;
  user: UserWithRelations;
};

export type ReservationWithRelations = z.infer<typeof ReservationSchema> & ReservationRelations

export const ReservationWithRelationsSchema: z.ZodType<ReservationWithRelations> = ReservationSchema.merge(z.object({
  order: z.lazy(() => OrderWithRelationsSchema),
  event: z.lazy(() => EventWithRelationsSchema),
  user: z.lazy(() => UserWithRelationsSchema),
}))

/////////////////////////////////////////
// RESERVATION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type ReservationOptionalDefaultsRelations = {
  order: OrderOptionalDefaultsWithRelations;
  event: EventOptionalDefaultsWithRelations;
  user: UserOptionalDefaultsWithRelations;
};

export type ReservationOptionalDefaultsWithRelations = z.infer<typeof ReservationOptionalDefaultsSchema> & ReservationOptionalDefaultsRelations

export const ReservationOptionalDefaultsWithRelationsSchema: z.ZodType<ReservationOptionalDefaultsWithRelations> = ReservationOptionalDefaultsSchema.merge(z.object({
  order: z.lazy(() => OrderOptionalDefaultsWithRelationsSchema),
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  user: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// RESERVATION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type ReservationPartialRelations = {
  order?: OrderPartialWithRelations;
  event?: EventPartialWithRelations;
  user?: UserPartialWithRelations;
};

export type ReservationPartialWithRelations = z.infer<typeof ReservationPartialSchema> & ReservationPartialRelations

export const ReservationPartialWithRelationsSchema: z.ZodType<ReservationPartialWithRelations> = ReservationPartialSchema.merge(z.object({
  order: z.lazy(() => OrderPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
})).partial()

export type ReservationOptionalDefaultsWithPartialRelations = z.infer<typeof ReservationOptionalDefaultsSchema> & ReservationPartialRelations

export const ReservationOptionalDefaultsWithPartialRelationsSchema: z.ZodType<ReservationOptionalDefaultsWithPartialRelations> = ReservationOptionalDefaultsSchema.merge(z.object({
  order: z.lazy(() => OrderPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export type ReservationWithPartialRelations = z.infer<typeof ReservationSchema> & ReservationPartialRelations

export const ReservationWithPartialRelationsSchema: z.ZodType<ReservationWithPartialRelations> = ReservationSchema.merge(z.object({
  order: z.lazy(() => OrderPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema),
  user: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export default ReservationSchema;
