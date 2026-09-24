import { z } from 'zod';
import { PreferredDanceRoleSchema } from '../inputTypeSchemas/PreferredDanceRoleSchema'
import { ProspectStatusSchema } from '../inputTypeSchemas/ProspectStatusSchema'
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'

/////////////////////////////////////////
// PROSPECT SCHEMA
/////////////////////////////////////////

/**
 * **Chi è venuto all'open day di un corso e non si è iscritto.**
 * 
 * Non è un'iscrizione — non ha titolo né ruolo assegnato — e non è una
 * `Person`: l'anagrafica globale non porta filtro di tenancy e pretende
 * un'email unica, mentre questo è un contatto che **la scuola** ha raccolto, e
 * che nessun'altra organizzazione deve vedere. Spesso, poi, c'è solo il
 * telefono.
 */
export const ProspectSchema = z.object({
  preferredRole: PreferredDanceRoleSchema.nullish(),
  status: ProspectStatusSchema,
  id: z.number().int(),
  /**
   * Derivata dal corso di provenienza, mai dal corpo della richiesta.
   */
  organizationId: z.number().int(),
  /**
   * Il corso di cui ha seguito l'open day. `Restrict`: un corso si cancella
   * soft, e la provenienza di un contatto non deve sparire con lui.
   */
  sourceEventId: z.number().int(),
  name: z.string(),
  surname: z.string().nullish(),
  /**
   * In minuscolo, scritta dal servizio: è la chiave con cui si riconosce
   * l'iscrizione che lo converte (`19` §4).
   */
  email: z.string().nullish(),
  phone: z.string().nullish(),
  note: z.string().nullish(),
  /**
   * **Quando ha acconsentito a essere ricontattato.** Obbligatorio: senza
   * consenso un contatto non si raccoglie per ricontattarlo, ed è questa
   * colonna a dimostrarlo (`19` §3). Scritta dal server alla creazione.
   */
  consentAt: z.coerce.date(),
  /**
   * Scritta dal server al passaggio a `CONTACTED`.
   */
  contactedAt: z.coerce.date().nullish(),
  /**
   * **L'iscrizione che lo ha convertito**, trovata dal server confrontando le
   * email — mai dichiarata dal client (`19` §4). `SetNull`: se l'iscrizione
   * sparisce, il prospect torna a essere un contatto da lavorare.
   */
  convertedRegistrationId: z.number().int().nullish(),
  convertedAt: z.coerce.date().nullish(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Prospect = z.infer<typeof ProspectSchema>

/////////////////////////////////////////
// PROSPECT PARTIAL SCHEMA
/////////////////////////////////////////

export const ProspectPartialSchema = ProspectSchema.partial()

export type ProspectPartial = z.infer<typeof ProspectPartialSchema>

/////////////////////////////////////////
// PROSPECT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const ProspectOptionalDefaultsSchema = ProspectSchema.merge(z.object({
  status: ProspectStatusSchema.optional(),
  id: z.number().int().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type ProspectOptionalDefaults = z.infer<typeof ProspectOptionalDefaultsSchema>

/////////////////////////////////////////
// PROSPECT RELATION SCHEMA
/////////////////////////////////////////

export type ProspectRelations = {
  organization: OrganizationWithRelations;
  sourceEvent: EventWithRelations;
  convertedRegistration?: RegistrationWithRelations | null;
};

export type ProspectWithRelations = z.infer<typeof ProspectSchema> & ProspectRelations

export const ProspectWithRelationsSchema: z.ZodType<ProspectWithRelations> = ProspectSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  sourceEvent: z.lazy(() => EventWithRelationsSchema),
  convertedRegistration: z.lazy(() => RegistrationWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// PROSPECT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type ProspectOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  sourceEvent: EventOptionalDefaultsWithRelations;
  convertedRegistration?: RegistrationOptionalDefaultsWithRelations | null;
};

export type ProspectOptionalDefaultsWithRelations = z.infer<typeof ProspectOptionalDefaultsSchema> & ProspectOptionalDefaultsRelations

export const ProspectOptionalDefaultsWithRelationsSchema: z.ZodType<ProspectOptionalDefaultsWithRelations> = ProspectOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  sourceEvent: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  convertedRegistration: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// PROSPECT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type ProspectPartialRelations = {
  organization?: OrganizationPartialWithRelations;
  sourceEvent?: EventPartialWithRelations;
  convertedRegistration?: RegistrationPartialWithRelations | null;
};

export type ProspectPartialWithRelations = z.infer<typeof ProspectPartialSchema> & ProspectPartialRelations

export const ProspectPartialWithRelationsSchema: z.ZodType<ProspectPartialWithRelations> = ProspectPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  sourceEvent: z.lazy(() => EventPartialWithRelationsSchema),
  convertedRegistration: z.lazy(() => RegistrationPartialWithRelationsSchema).nullish(),
})).partial()

export type ProspectOptionalDefaultsWithPartialRelations = z.infer<typeof ProspectOptionalDefaultsSchema> & ProspectPartialRelations

export const ProspectOptionalDefaultsWithPartialRelationsSchema: z.ZodType<ProspectOptionalDefaultsWithPartialRelations> = ProspectOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  sourceEvent: z.lazy(() => EventPartialWithRelationsSchema),
  convertedRegistration: z.lazy(() => RegistrationPartialWithRelationsSchema).nullish(),
}).partial())

export type ProspectWithPartialRelations = z.infer<typeof ProspectSchema> & ProspectPartialRelations

export const ProspectWithPartialRelationsSchema: z.ZodType<ProspectWithPartialRelations> = ProspectSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  sourceEvent: z.lazy(() => EventPartialWithRelationsSchema),
  convertedRegistration: z.lazy(() => RegistrationPartialWithRelationsSchema).nullish(),
}).partial())

export default ProspectSchema;
