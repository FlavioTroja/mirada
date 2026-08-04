import { z } from 'zod';
import { TicketTypeWithRelationsSchema, TicketTypePartialWithRelationsSchema, TicketTypeOptionalDefaultsWithRelationsSchema } from './TicketTypeSchema'
import type { TicketTypeWithRelations, TicketTypePartialWithRelations, TicketTypeOptionalDefaultsWithRelations } from './TicketTypeSchema'
import { SessionWithRelationsSchema, SessionPartialWithRelationsSchema, SessionOptionalDefaultsWithRelationsSchema } from './SessionSchema'
import type { SessionWithRelations, SessionPartialWithRelations, SessionOptionalDefaultsWithRelations } from './SessionSchema'

/////////////////////////////////////////
// TICKET TYPE SESSION SCHEMA
/////////////////////////////////////////

/**
 * Elenco ESPLICITO delle sessioni incluse nel titolo.
 */
export const TicketTypeSessionSchema = z.object({
  id: z.number().int(),
  ticketTypeId: z.number().int(),
  sessionId: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type TicketTypeSession = z.infer<typeof TicketTypeSessionSchema>

/////////////////////////////////////////
// TICKET TYPE SESSION PARTIAL SCHEMA
/////////////////////////////////////////

export const TicketTypeSessionPartialSchema = TicketTypeSessionSchema.partial()

export type TicketTypeSessionPartial = z.infer<typeof TicketTypeSessionPartialSchema>

/////////////////////////////////////////
// TICKET TYPE SESSION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const TicketTypeSessionOptionalDefaultsSchema = TicketTypeSessionSchema.merge(z.object({
  id: z.number().int().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type TicketTypeSessionOptionalDefaults = z.infer<typeof TicketTypeSessionOptionalDefaultsSchema>

/////////////////////////////////////////
// TICKET TYPE SESSION RELATION SCHEMA
/////////////////////////////////////////

export type TicketTypeSessionRelations = {
  ticketType: TicketTypeWithRelations;
  session: SessionWithRelations;
};

export type TicketTypeSessionWithRelations = z.infer<typeof TicketTypeSessionSchema> & TicketTypeSessionRelations

export const TicketTypeSessionWithRelationsSchema: z.ZodType<TicketTypeSessionWithRelations> = TicketTypeSessionSchema.merge(z.object({
  ticketType: z.lazy(() => TicketTypeWithRelationsSchema),
  session: z.lazy(() => SessionWithRelationsSchema),
}))

/////////////////////////////////////////
// TICKET TYPE SESSION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type TicketTypeSessionOptionalDefaultsRelations = {
  ticketType: TicketTypeOptionalDefaultsWithRelations;
  session: SessionOptionalDefaultsWithRelations;
};

export type TicketTypeSessionOptionalDefaultsWithRelations = z.infer<typeof TicketTypeSessionOptionalDefaultsSchema> & TicketTypeSessionOptionalDefaultsRelations

export const TicketTypeSessionOptionalDefaultsWithRelationsSchema: z.ZodType<TicketTypeSessionOptionalDefaultsWithRelations> = TicketTypeSessionOptionalDefaultsSchema.merge(z.object({
  ticketType: z.lazy(() => TicketTypeOptionalDefaultsWithRelationsSchema),
  session: z.lazy(() => SessionOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// TICKET TYPE SESSION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type TicketTypeSessionPartialRelations = {
  ticketType?: TicketTypePartialWithRelations;
  session?: SessionPartialWithRelations;
};

export type TicketTypeSessionPartialWithRelations = z.infer<typeof TicketTypeSessionPartialSchema> & TicketTypeSessionPartialRelations

export const TicketTypeSessionPartialWithRelationsSchema: z.ZodType<TicketTypeSessionPartialWithRelations> = TicketTypeSessionPartialSchema.merge(z.object({
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
  session: z.lazy(() => SessionPartialWithRelationsSchema),
})).partial()

export type TicketTypeSessionOptionalDefaultsWithPartialRelations = z.infer<typeof TicketTypeSessionOptionalDefaultsSchema> & TicketTypeSessionPartialRelations

export const TicketTypeSessionOptionalDefaultsWithPartialRelationsSchema: z.ZodType<TicketTypeSessionOptionalDefaultsWithPartialRelations> = TicketTypeSessionOptionalDefaultsSchema.merge(z.object({
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
  session: z.lazy(() => SessionPartialWithRelationsSchema),
}).partial())

export type TicketTypeSessionWithPartialRelations = z.infer<typeof TicketTypeSessionSchema> & TicketTypeSessionPartialRelations

export const TicketTypeSessionWithPartialRelationsSchema: z.ZodType<TicketTypeSessionWithPartialRelations> = TicketTypeSessionSchema.merge(z.object({
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
  session: z.lazy(() => SessionPartialWithRelationsSchema),
}).partial())

export default TicketTypeSessionSchema;
