import { z } from 'zod';
import { PassIssuanceReasonSchema } from '../inputTypeSchemas/PassIssuanceReasonSchema'
import { DanceRoleSchema } from '../inputTypeSchemas/DanceRoleSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { TicketTypeWithRelationsSchema, TicketTypePartialWithRelationsSchema, TicketTypeOptionalDefaultsWithRelationsSchema } from './TicketTypeSchema'
import type { TicketTypeWithRelations, TicketTypePartialWithRelations, TicketTypeOptionalDefaultsWithRelations } from './TicketTypeSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'
import { TicketWithRelationsSchema, TicketPartialWithRelationsSchema, TicketOptionalDefaultsWithRelationsSchema } from './TicketSchema'
import type { TicketWithRelations, TicketPartialWithRelations, TicketOptionalDefaultsWithRelations } from './TicketSchema'

/////////////////////////////////////////
// PASS ISSUANCE SCHEMA
/////////////////////////////////////////

/**
 * Emissione manuale di pass — accrediti, vendite esterne, omaggi, cortesie.
 * 
 * **Non è mai bloccata dalle quote** (`RB20`, `RF-TCK-14`): si registra il
 * consumo, si restituisce un avviso se si supera la capienza della sala, e si
 * procede. La responsabilità della sala è dell'organizzatore, non della
 * piattaforma, e un blocco qui trasformerebbe uno strumento di servizio in un
 * ostacolo la sera dell'evento.
 * 
 * `role` è **obbligatorio quando l'evento usa quote per ruolo** (`RF-TCK-15`):
 * senza quel dato l'equilibrio leader/follower mostrato all'organizzatore
 * diventa falso proprio dove serve. Il vincolo è del servizio, non della
 * tabella, perché dipende dalla configurazione dell'evento.
 */
export const PassIssuanceSchema = z.object({
  reason: PassIssuanceReasonSchema,
  role: DanceRoleSchema.nullish(),
  id: z.number().int(),
  eventId: z.number().int(),
  ticketTypeId: z.number().int(),
  issuedByUserId: z.number().int(),
  quantity: z.number().int(),
  /**
   * Falso = pass **al portatore**, senza nominativo e **non trasferibili**.
   */
  nominal: z.boolean(),
  note: z.string().nullish(),
  issuedAt: z.coerce.date(),
  revokedAt: z.coerce.date().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type PassIssuance = z.infer<typeof PassIssuanceSchema>

/////////////////////////////////////////
// PASS ISSUANCE PARTIAL SCHEMA
/////////////////////////////////////////

export const PassIssuancePartialSchema = PassIssuanceSchema.partial()

export type PassIssuancePartial = z.infer<typeof PassIssuancePartialSchema>

/////////////////////////////////////////
// PASS ISSUANCE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PassIssuanceOptionalDefaultsSchema = PassIssuanceSchema.merge(z.object({
  id: z.number().int().optional(),
  quantity: z.number().int().optional(),
  /**
   * Falso = pass **al portatore**, senza nominativo e **non trasferibili**.
   */
  nominal: z.boolean().optional(),
  issuedAt: z.coerce.date().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type PassIssuanceOptionalDefaults = z.infer<typeof PassIssuanceOptionalDefaultsSchema>

/////////////////////////////////////////
// PASS ISSUANCE RELATION SCHEMA
/////////////////////////////////////////

export type PassIssuanceRelations = {
  event: EventWithRelations;
  ticketType: TicketTypeWithRelations;
  issuedBy: UserWithRelations;
  tickets: TicketWithRelations[];
};

export type PassIssuanceWithRelations = z.infer<typeof PassIssuanceSchema> & PassIssuanceRelations

export const PassIssuanceWithRelationsSchema: z.ZodType<PassIssuanceWithRelations> = PassIssuanceSchema.merge(z.object({
  event: z.lazy(() => EventWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypeWithRelationsSchema),
  issuedBy: z.lazy(() => UserWithRelationsSchema),
  tickets: z.lazy(() => TicketWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// PASS ISSUANCE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PassIssuanceOptionalDefaultsRelations = {
  event: EventOptionalDefaultsWithRelations;
  ticketType: TicketTypeOptionalDefaultsWithRelations;
  issuedBy: UserOptionalDefaultsWithRelations;
  tickets: TicketOptionalDefaultsWithRelations[];
};

export type PassIssuanceOptionalDefaultsWithRelations = z.infer<typeof PassIssuanceOptionalDefaultsSchema> & PassIssuanceOptionalDefaultsRelations

export const PassIssuanceOptionalDefaultsWithRelationsSchema: z.ZodType<PassIssuanceOptionalDefaultsWithRelations> = PassIssuanceOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypeOptionalDefaultsWithRelationsSchema),
  issuedBy: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
  tickets: z.lazy(() => TicketOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// PASS ISSUANCE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PassIssuancePartialRelations = {
  event?: EventPartialWithRelations;
  ticketType?: TicketTypePartialWithRelations;
  issuedBy?: UserPartialWithRelations;
  tickets?: TicketPartialWithRelations[];
};

export type PassIssuancePartialWithRelations = z.infer<typeof PassIssuancePartialSchema> & PassIssuancePartialRelations

export const PassIssuancePartialWithRelationsSchema: z.ZodType<PassIssuancePartialWithRelations> = PassIssuancePartialSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
  issuedBy: z.lazy(() => UserPartialWithRelationsSchema),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
})).partial()

export type PassIssuanceOptionalDefaultsWithPartialRelations = z.infer<typeof PassIssuanceOptionalDefaultsSchema> & PassIssuancePartialRelations

export const PassIssuanceOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PassIssuanceOptionalDefaultsWithPartialRelations> = PassIssuanceOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
  issuedBy: z.lazy(() => UserPartialWithRelationsSchema),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
}).partial())

export type PassIssuanceWithPartialRelations = z.infer<typeof PassIssuanceSchema> & PassIssuancePartialRelations

export const PassIssuanceWithPartialRelationsSchema: z.ZodType<PassIssuanceWithPartialRelations> = PassIssuanceSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
  issuedBy: z.lazy(() => UserPartialWithRelationsSchema),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
}).partial())

export default PassIssuanceSchema;
