import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { TicketWithRelationsSchema, TicketPartialWithRelationsSchema, TicketOptionalDefaultsWithRelationsSchema } from './TicketSchema'
import type { TicketWithRelations, TicketPartialWithRelations, TicketOptionalDefaultsWithRelations } from './TicketSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// TICKET TRANSFER SCHEMA
/////////////////////////////////////////

/**
 * Storico completo dei passaggi di titolarità — **sola lettura via API**: si
 * crea soltanto attraverso `POST /tickets/:id/transfer` (§3.4).
 * 
 * `fromHolder` e `toHolder` sono fotografie del nominativo al momento del
 * passaggio: restano leggibili anche se l'utente collegato viene poi cancellato,
 * ed è la ragione per cui non sono ricostruite dalle chiavi esterne.
 */
export const TicketTransferSchema = z.object({
  id: z.number().int(),
  ticketId: z.number().int(),
  fromUserId: z.number().int().nullish(),
  toUserId: z.number().int().nullish(),
  /**
   * `{ name, surname, email? }`
   */
  fromHolder: JsonValueSchema,
  toHolder: JsonValueSchema,
  /**
   * Il `code` invalidato dal passaggio: da qui in poi non apre più nulla.
   */
  previousCode: z.string(),
  transferredAt: z.coerce.date(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type TicketTransfer = z.infer<typeof TicketTransferSchema>

/////////////////////////////////////////
// TICKET TRANSFER PARTIAL SCHEMA
/////////////////////////////////////////

export const TicketTransferPartialSchema = TicketTransferSchema.partial()

export type TicketTransferPartial = z.infer<typeof TicketTransferPartialSchema>

/////////////////////////////////////////
// TICKET TRANSFER OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const TicketTransferOptionalDefaultsSchema = TicketTransferSchema.merge(z.object({
  id: z.number().int().optional(),
  transferredAt: z.coerce.date().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type TicketTransferOptionalDefaults = z.infer<typeof TicketTransferOptionalDefaultsSchema>

/////////////////////////////////////////
// TICKET TRANSFER RELATION SCHEMA
/////////////////////////////////////////

export type TicketTransferRelations = {
  ticket: TicketWithRelations;
  fromUser?: UserWithRelations | null;
  toUser?: UserWithRelations | null;
};

export type TicketTransferWithRelations = z.infer<typeof TicketTransferSchema> & TicketTransferRelations

export const TicketTransferWithRelationsSchema: z.ZodType<TicketTransferWithRelations> = TicketTransferSchema.merge(z.object({
  ticket: z.lazy(() => TicketWithRelationsSchema),
  fromUser: z.lazy(() => UserWithRelationsSchema).nullish(),
  toUser: z.lazy(() => UserWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// TICKET TRANSFER OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type TicketTransferOptionalDefaultsRelations = {
  ticket: TicketOptionalDefaultsWithRelations;
  fromUser?: UserOptionalDefaultsWithRelations | null;
  toUser?: UserOptionalDefaultsWithRelations | null;
};

export type TicketTransferOptionalDefaultsWithRelations = z.infer<typeof TicketTransferOptionalDefaultsSchema> & TicketTransferOptionalDefaultsRelations

export const TicketTransferOptionalDefaultsWithRelationsSchema: z.ZodType<TicketTransferOptionalDefaultsWithRelations> = TicketTransferOptionalDefaultsSchema.merge(z.object({
  ticket: z.lazy(() => TicketOptionalDefaultsWithRelationsSchema),
  fromUser: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullish(),
  toUser: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// TICKET TRANSFER PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type TicketTransferPartialRelations = {
  ticket?: TicketPartialWithRelations;
  fromUser?: UserPartialWithRelations | null;
  toUser?: UserPartialWithRelations | null;
};

export type TicketTransferPartialWithRelations = z.infer<typeof TicketTransferPartialSchema> & TicketTransferPartialRelations

export const TicketTransferPartialWithRelationsSchema: z.ZodType<TicketTransferPartialWithRelations> = TicketTransferPartialSchema.merge(z.object({
  ticket: z.lazy(() => TicketPartialWithRelationsSchema),
  fromUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  toUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
})).partial()

export type TicketTransferOptionalDefaultsWithPartialRelations = z.infer<typeof TicketTransferOptionalDefaultsSchema> & TicketTransferPartialRelations

export const TicketTransferOptionalDefaultsWithPartialRelationsSchema: z.ZodType<TicketTransferOptionalDefaultsWithPartialRelations> = TicketTransferOptionalDefaultsSchema.merge(z.object({
  ticket: z.lazy(() => TicketPartialWithRelationsSchema),
  fromUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  toUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
}).partial())

export type TicketTransferWithPartialRelations = z.infer<typeof TicketTransferSchema> & TicketTransferPartialRelations

export const TicketTransferWithPartialRelationsSchema: z.ZodType<TicketTransferWithPartialRelations> = TicketTransferSchema.merge(z.object({
  ticket: z.lazy(() => TicketPartialWithRelationsSchema),
  fromUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  toUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
}).partial())

export default TicketTransferSchema;
