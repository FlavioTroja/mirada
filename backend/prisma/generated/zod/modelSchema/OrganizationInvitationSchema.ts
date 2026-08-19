import { z } from 'zod';
import { OrgMemberRoleSchema } from '../inputTypeSchemas/OrgMemberRoleSchema'
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// ORGANIZATION INVITATION SCHEMA
/////////////////////////////////////////

/**
 * **L'invito a entrare in un'organizzazione che esiste già.**
 * 
 * È ciò che permette a un secondo organizzatore di raggiungere un tenant che
 * non ha aperto lui. La regola che governa tutta l'autoregistrazione è che sia
 * **il gettone a decidere se nasce un tenant**: chi arriva senza invito apre
 * un'organizzazione nuova, chi arriva con un invito valido entra in quella
 * indicata e nessuna organizzazione viene creata.
 * 
 * ── Perché una riga, e non un gettone firmato ────────────────────────────────
 * I link di conferma dell'email sono gettoni firmati **senza stato**
 * (`@utils/helpers/emailToken`), e lì è la scelta giusta. Qui no: un invito
 * deve poter essere **revocato** prima della scadenza, e speso **una volta
 * sola**. Una firma non sa fare né l'una né l'altra cosa — dice soltanto
 * «questo l'ho emesso io» — mentre una riga porta `revokedAt` e `acceptedAt` e
 * risponde a entrambe le domande.
 */
export const OrganizationInvitationSchema = z.object({
  /**
   * Oggi vale solo `OWNER`: si invitano altri titolari. Gli altri due ruoli si
   * assegnano dal backoffice a chi un'utenza ce l'ha già, e non hanno bisogno
   * di una strada d'ingresso propria.
   */
  role: OrgMemberRoleSchema,
  id: z.number().int(),
  organizationId: z.number().int(),
  /**
   * L'indirizzo a cui l'invito è stato mandato, normalizzato in minuscolo.
   * 
   * ⚠️ Chi accetta deve autenticarsi **con questo indirizzo**. Senza il
   * vincolo, un link inoltrato — anche solo per sbaglio, anche solo perché la
   * casella è condivisa — regalerebbe a un estraneo il ruolo di titolare di
   * un'organizzazione altrui.
   */
  email: z.string(),
  /**
   * **L'impronta** del gettone, non il gettone. Chi legge la banca dati non
   * deve poter entrare in un'organizzazione: l'originale esiste solo dentro il
   * link, cioè nella casella di posta dell'invitato.
   */
  tokenHash: z.string(),
  invitedById: z.number().int(),
  expiresAt: z.coerce.date(),
  acceptedAt: z.coerce.date().nullish(),
  /**
   * Chi ha accettato. Resta anche dopo, perché «chi ha fatto entrare chi» è
   * esattamente la domanda che ci si pone mesi più tardi.
   */
  acceptedById: z.number().int().nullish(),
  revokedAt: z.coerce.date().nullish(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type OrganizationInvitation = z.infer<typeof OrganizationInvitationSchema>

/////////////////////////////////////////
// ORGANIZATION INVITATION PARTIAL SCHEMA
/////////////////////////////////////////

export const OrganizationInvitationPartialSchema = OrganizationInvitationSchema.partial()

export type OrganizationInvitationPartial = z.infer<typeof OrganizationInvitationPartialSchema>

/////////////////////////////////////////
// ORGANIZATION INVITATION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const OrganizationInvitationOptionalDefaultsSchema = OrganizationInvitationSchema.merge(z.object({
  /**
   * Oggi vale solo `OWNER`: si invitano altri titolari. Gli altri due ruoli si
   * assegnano dal backoffice a chi un'utenza ce l'ha già, e non hanno bisogno
   * di una strada d'ingresso propria.
   */
  role: OrgMemberRoleSchema.optional(),
  id: z.number().int().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type OrganizationInvitationOptionalDefaults = z.infer<typeof OrganizationInvitationOptionalDefaultsSchema>

/////////////////////////////////////////
// ORGANIZATION INVITATION RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationInvitationRelations = {
  organization: OrganizationWithRelations;
  invitedBy: UserWithRelations;
  acceptedBy?: UserWithRelations | null;
};

export type OrganizationInvitationWithRelations = z.infer<typeof OrganizationInvitationSchema> & OrganizationInvitationRelations

export const OrganizationInvitationWithRelationsSchema: z.ZodType<OrganizationInvitationWithRelations> = OrganizationInvitationSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  invitedBy: z.lazy(() => UserWithRelationsSchema),
  acceptedBy: z.lazy(() => UserWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// ORGANIZATION INVITATION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationInvitationOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  invitedBy: UserOptionalDefaultsWithRelations;
  acceptedBy?: UserOptionalDefaultsWithRelations | null;
};

export type OrganizationInvitationOptionalDefaultsWithRelations = z.infer<typeof OrganizationInvitationOptionalDefaultsSchema> & OrganizationInvitationOptionalDefaultsRelations

export const OrganizationInvitationOptionalDefaultsWithRelationsSchema: z.ZodType<OrganizationInvitationOptionalDefaultsWithRelations> = OrganizationInvitationOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  invitedBy: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
  acceptedBy: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullish(),
}))

/////////////////////////////////////////
// ORGANIZATION INVITATION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type OrganizationInvitationPartialRelations = {
  organization?: OrganizationPartialWithRelations;
  invitedBy?: UserPartialWithRelations;
  acceptedBy?: UserPartialWithRelations | null;
};

export type OrganizationInvitationPartialWithRelations = z.infer<typeof OrganizationInvitationPartialSchema> & OrganizationInvitationPartialRelations

export const OrganizationInvitationPartialWithRelationsSchema: z.ZodType<OrganizationInvitationPartialWithRelations> = OrganizationInvitationPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  invitedBy: z.lazy(() => UserPartialWithRelationsSchema),
  acceptedBy: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
})).partial()

export type OrganizationInvitationOptionalDefaultsWithPartialRelations = z.infer<typeof OrganizationInvitationOptionalDefaultsSchema> & OrganizationInvitationPartialRelations

export const OrganizationInvitationOptionalDefaultsWithPartialRelationsSchema: z.ZodType<OrganizationInvitationOptionalDefaultsWithPartialRelations> = OrganizationInvitationOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  invitedBy: z.lazy(() => UserPartialWithRelationsSchema),
  acceptedBy: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
}).partial())

export type OrganizationInvitationWithPartialRelations = z.infer<typeof OrganizationInvitationSchema> & OrganizationInvitationPartialRelations

export const OrganizationInvitationWithPartialRelationsSchema: z.ZodType<OrganizationInvitationWithPartialRelations> = OrganizationInvitationSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  invitedBy: z.lazy(() => UserPartialWithRelationsSchema),
  acceptedBy: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
}).partial())

export default OrganizationInvitationSchema;
