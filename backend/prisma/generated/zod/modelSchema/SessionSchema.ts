import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { TicketTypeSessionWithRelationsSchema, TicketTypeSessionPartialWithRelationsSchema, TicketTypeSessionOptionalDefaultsWithRelationsSchema } from './TicketTypeSessionSchema'
import type { TicketTypeSessionWithRelations, TicketTypeSessionPartialWithRelations, TicketTypeSessionOptionalDefaultsWithRelations } from './TicketTypeSessionSchema'

/////////////////////////////////////////
// SESSION SCHEMA
/////////////////////////////////////////

export const SessionSchema = z.object({
  id: z.number().int(),
  eventId: z.number().int(),
  /**
   * I18nText { it, en? }
   */
  name: JsonValueSchema,
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  room: z.string().nullish(),
  level: z.string().nullish(),
  /**
   * Peso di ripartizione (`RF-EVT-36`): default uniforme calcolato dal servizio.
   */
  allocationWeight: z.number().int(),
  /**
   * Sessione implicita reale creata dal servizio quando l'EventType ha
   * `capMultiSession = false`: il check-in di una milonga singola gira sullo
   * stesso codice di quello di un festival (§4.6).
   */
  isImplicit: z.boolean(),
  cancelledAt: z.coerce.date().nullish(),
  cancellationReason: z.string().nullish(),
  sortOrder: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Session = z.infer<typeof SessionSchema>

/////////////////////////////////////////
// SESSION PARTIAL SCHEMA
/////////////////////////////////////////

export const SessionPartialSchema = SessionSchema.partial()

export type SessionPartial = z.infer<typeof SessionPartialSchema>

/////////////////////////////////////////
// SESSION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const SessionOptionalDefaultsSchema = SessionSchema.merge(z.object({
  id: z.number().int().optional(),
  /**
   * Peso di ripartizione (`RF-EVT-36`): default uniforme calcolato dal servizio.
   */
  allocationWeight: z.number().int().optional(),
  /**
   * Sessione implicita reale creata dal servizio quando l'EventType ha
   * `capMultiSession = false`: il check-in di una milonga singola gira sullo
   * stesso codice di quello di un festival (§4.6).
   */
  isImplicit: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type SessionOptionalDefaults = z.infer<typeof SessionOptionalDefaultsSchema>

/////////////////////////////////////////
// SESSION RELATION SCHEMA
/////////////////////////////////////////

export type SessionRelations = {
  event: EventWithRelations;
  ticketTypeSessions: TicketTypeSessionWithRelations[];
};

export type SessionWithRelations = z.infer<typeof SessionSchema> & SessionRelations

export const SessionWithRelationsSchema: z.ZodType<SessionWithRelations> = SessionSchema.merge(z.object({
  event: z.lazy(() => EventWithRelationsSchema),
  ticketTypeSessions: z.lazy(() => TicketTypeSessionWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// SESSION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type SessionOptionalDefaultsRelations = {
  event: EventOptionalDefaultsWithRelations;
  ticketTypeSessions: TicketTypeSessionOptionalDefaultsWithRelations[];
};

export type SessionOptionalDefaultsWithRelations = z.infer<typeof SessionOptionalDefaultsSchema> & SessionOptionalDefaultsRelations

export const SessionOptionalDefaultsWithRelationsSchema: z.ZodType<SessionOptionalDefaultsWithRelations> = SessionOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  ticketTypeSessions: z.lazy(() => TicketTypeSessionOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// SESSION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type SessionPartialRelations = {
  event?: EventPartialWithRelations;
  ticketTypeSessions?: TicketTypeSessionPartialWithRelations[];
};

export type SessionPartialWithRelations = z.infer<typeof SessionPartialSchema> & SessionPartialRelations

export const SessionPartialWithRelationsSchema: z.ZodType<SessionPartialWithRelations> = SessionPartialSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  ticketTypeSessions: z.lazy(() => TicketTypeSessionPartialWithRelationsSchema).array(),
})).partial()

export type SessionOptionalDefaultsWithPartialRelations = z.infer<typeof SessionOptionalDefaultsSchema> & SessionPartialRelations

export const SessionOptionalDefaultsWithPartialRelationsSchema: z.ZodType<SessionOptionalDefaultsWithPartialRelations> = SessionOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  ticketTypeSessions: z.lazy(() => TicketTypeSessionPartialWithRelationsSchema).array(),
}).partial())

export type SessionWithPartialRelations = z.infer<typeof SessionSchema> & SessionPartialRelations

export const SessionWithPartialRelationsSchema: z.ZodType<SessionWithPartialRelations> = SessionSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  ticketTypeSessions: z.lazy(() => TicketTypeSessionPartialWithRelationsSchema).array(),
}).partial())

export default SessionSchema;
