import { z } from 'zod';
import { FileWithRelationsSchema, FilePartialWithRelationsSchema, FileOptionalDefaultsWithRelationsSchema } from './FileSchema'
import type { FileWithRelations, FilePartialWithRelations, FileOptionalDefaultsWithRelations } from './FileSchema'
import { PersonWithRelationsSchema, PersonPartialWithRelationsSchema, PersonOptionalDefaultsWithRelationsSchema } from './PersonSchema'
import type { PersonWithRelations, PersonPartialWithRelations, PersonOptionalDefaultsWithRelations } from './PersonSchema'
import { RoleToUserWithRelationsSchema, RoleToUserPartialWithRelationsSchema, RoleToUserOptionalDefaultsWithRelationsSchema } from './RoleToUserSchema'
import type { RoleToUserWithRelations, RoleToUserPartialWithRelations, RoleToUserOptionalDefaultsWithRelations } from './RoleToUserSchema'
import { LogWithRelationsSchema, LogPartialWithRelationsSchema, LogOptionalDefaultsWithRelationsSchema } from './LogSchema'
import type { LogWithRelations, LogPartialWithRelations, LogOptionalDefaultsWithRelations } from './LogSchema'
import { DancerProfileWithRelationsSchema, DancerProfilePartialWithRelationsSchema, DancerProfileOptionalDefaultsWithRelationsSchema } from './DancerProfileSchema'
import type { DancerProfileWithRelations, DancerProfilePartialWithRelations, DancerProfileOptionalDefaultsWithRelations } from './DancerProfileSchema'
import { OrganizationMemberWithRelationsSchema, OrganizationMemberPartialWithRelationsSchema, OrganizationMemberOptionalDefaultsWithRelationsSchema } from './OrganizationMemberSchema'
import type { OrganizationMemberWithRelations, OrganizationMemberPartialWithRelations, OrganizationMemberOptionalDefaultsWithRelations } from './OrganizationMemberSchema'
import { OrganizationInvitationWithRelationsSchema, OrganizationInvitationPartialWithRelationsSchema, OrganizationInvitationOptionalDefaultsWithRelationsSchema } from './OrganizationInvitationSchema'
import type { OrganizationInvitationWithRelations, OrganizationInvitationPartialWithRelations, OrganizationInvitationOptionalDefaultsWithRelations } from './OrganizationInvitationSchema'
import { FiscalDeclarationWithRelationsSchema, FiscalDeclarationPartialWithRelationsSchema, FiscalDeclarationOptionalDefaultsWithRelationsSchema } from './FiscalDeclarationSchema'
import type { FiscalDeclarationWithRelations, FiscalDeclarationPartialWithRelations, FiscalDeclarationOptionalDefaultsWithRelations } from './FiscalDeclarationSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'
import { RequirementOutcomeWithRelationsSchema, RequirementOutcomePartialWithRelationsSchema, RequirementOutcomeOptionalDefaultsWithRelationsSchema } from './RequirementOutcomeSchema'
import type { RequirementOutcomeWithRelations, RequirementOutcomePartialWithRelations, RequirementOutcomeOptionalDefaultsWithRelations } from './RequirementOutcomeSchema'
import { PurchaseWithRelationsSchema, PurchasePartialWithRelationsSchema, PurchaseOptionalDefaultsWithRelationsSchema } from './PurchaseSchema'
import type { PurchaseWithRelations, PurchasePartialWithRelations, PurchaseOptionalDefaultsWithRelations } from './PurchaseSchema'
import { ReservationWithRelationsSchema, ReservationPartialWithRelationsSchema, ReservationOptionalDefaultsWithRelationsSchema } from './ReservationSchema'
import type { ReservationWithRelations, ReservationPartialWithRelations, ReservationOptionalDefaultsWithRelations } from './ReservationSchema'
import { PassIssuanceWithRelationsSchema, PassIssuancePartialWithRelationsSchema, PassIssuanceOptionalDefaultsWithRelationsSchema } from './PassIssuanceSchema'
import type { PassIssuanceWithRelations, PassIssuancePartialWithRelations, PassIssuanceOptionalDefaultsWithRelations } from './PassIssuanceSchema'
import { TicketTransferWithRelationsSchema, TicketTransferPartialWithRelationsSchema, TicketTransferOptionalDefaultsWithRelationsSchema } from './TicketTransferSchema'
import type { TicketTransferWithRelations, TicketTransferPartialWithRelations, TicketTransferOptionalDefaultsWithRelations } from './TicketTransferSchema'
import { CheckInWithRelationsSchema, CheckInPartialWithRelationsSchema, CheckInOptionalDefaultsWithRelationsSchema } from './CheckInSchema'
import type { CheckInWithRelations, CheckInPartialWithRelations, CheckInOptionalDefaultsWithRelations } from './CheckInSchema'

/////////////////////////////////////////
// USER SCHEMA
/////////////////////////////////////////

export const UserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  password: z.string(),
  wsCode: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  note: z.string().nullish(),
  enabled: z.boolean(),
  activatedAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
  /**
   * Quando il proprietario dell'indirizzo ha premuto il tasto nell'email di
   * conferma. **Nullo = mai confermato**, e l'accesso è rifiutato con
   * `EMAIL_NOT_CONFIRMED`.
   * 
   * Serve un campo suo e non `enabled`: `enabled` è la sospensione decisa da
   * un amministratore, questo è «l'indirizzo non è ancora stato dimostrato».
   * Confonderli darebbe a chi si è appena iscritto il messaggio «account
   * disabilitato» — che è falso e non dice cosa fare.
   * 
   * È anche ciò che rende il link di conferma **usabile una volta sola in
   * modo utile**: al secondo clic il campo è già valorizzato e la risposta
   * diventa «già confermato, entra pure» invece di un errore.
   */
  emailVerifiedAt: z.coerce.date().nullish(),
  /**
   * L'identità su Authentik — il `sub` del token OIDC — quando l'utente
   * accede tramite il fornitore di identità invece che con la password.
   * 
   * **È il `sub` e non l'email di proposito.** L'email cambia: una persona
   * passa da un indirizzo personale a uno dell'organizzazione, e nel
   * frattempo il vecchio indirizzo può essere riassegnato a qualcun altro.
   * Il `sub` è un UUID che Authentik non riusa e che non cambia nemmeno
   * rinominando l'utente (`sub_mode: user_uuid` sul provider). Legare
   * l'identità all'email significherebbe che cambiare indirizzo equivale a
   * cambiare persona — o, peggio, che riassegnarlo equivale a cedere
   * l'account.
   * 
   * Nullo per chi non è mai passato dall'SSO: l'accesso con utente e
   * password resta attivo, quindi le due strade convivono. Si valorizza al
   * primo accesso SSO, agganciando l'utenza esistente (§SsoService).
   */
  authentikSub: z.string().nullish(),
  logoFileId: z.number().int().nullish(),
  personId: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type User = z.infer<typeof UserSchema>

/////////////////////////////////////////
// USER PARTIAL SCHEMA
/////////////////////////////////////////

export const UserPartialSchema = UserSchema.partial()

export type UserPartial = z.infer<typeof UserPartialSchema>

/////////////////////////////////////////
// USER OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const UserOptionalDefaultsSchema = UserSchema.merge(z.object({
  id: z.number().int().optional(),
  enabled: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type UserOptionalDefaults = z.infer<typeof UserOptionalDefaultsSchema>

/////////////////////////////////////////
// USER RELATION SCHEMA
/////////////////////////////////////////

export type UserRelations = {
  logoFile?: FileWithRelations | null;
  person: PersonWithRelations;
  roles: RoleToUserWithRelations[];
  logs: LogWithRelations[];
  dancerProfile?: DancerProfileWithRelations | null;
  organizationMemberships: OrganizationMemberWithRelations[];
  invitationsSent: OrganizationInvitationWithRelations[];
  invitationsAccepted: OrganizationInvitationWithRelations[];
  fiscalDeclarations: FiscalDeclarationWithRelations[];
  registrations: RegistrationWithRelations[];
  guardedRegistrations: RegistrationWithRelations[];
  reviewedRequirementOutcomes: RequirementOutcomeWithRelations[];
  purchases: PurchaseWithRelations[];
  reservations: ReservationWithRelations[];
  passIssuances: PassIssuanceWithRelations[];
  ticketTransfersFrom: TicketTransferWithRelations[];
  ticketTransfersTo: TicketTransferWithRelations[];
  checkIns: CheckInWithRelations[];
};

export type UserWithRelations = z.infer<typeof UserSchema> & UserRelations

export const UserWithRelationsSchema: z.ZodType<UserWithRelations> = UserSchema.merge(z.object({
  logoFile: z.lazy(() => FileWithRelationsSchema).nullish(),
  person: z.lazy(() => PersonWithRelationsSchema),
  roles: z.lazy(() => RoleToUserWithRelationsSchema).array(),
  logs: z.lazy(() => LogWithRelationsSchema).array(),
  dancerProfile: z.lazy(() => DancerProfileWithRelationsSchema).nullish(),
  organizationMemberships: z.lazy(() => OrganizationMemberWithRelationsSchema).array(),
  invitationsSent: z.lazy(() => OrganizationInvitationWithRelationsSchema).array(),
  invitationsAccepted: z.lazy(() => OrganizationInvitationWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationWithRelationsSchema).array(),
  guardedRegistrations: z.lazy(() => RegistrationWithRelationsSchema).array(),
  reviewedRequirementOutcomes: z.lazy(() => RequirementOutcomeWithRelationsSchema).array(),
  purchases: z.lazy(() => PurchaseWithRelationsSchema).array(),
  reservations: z.lazy(() => ReservationWithRelationsSchema).array(),
  passIssuances: z.lazy(() => PassIssuanceWithRelationsSchema).array(),
  ticketTransfersFrom: z.lazy(() => TicketTransferWithRelationsSchema).array(),
  ticketTransfersTo: z.lazy(() => TicketTransferWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// USER OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type UserOptionalDefaultsRelations = {
  logoFile?: FileOptionalDefaultsWithRelations | null;
  person: PersonOptionalDefaultsWithRelations;
  roles: RoleToUserOptionalDefaultsWithRelations[];
  logs: LogOptionalDefaultsWithRelations[];
  dancerProfile?: DancerProfileOptionalDefaultsWithRelations | null;
  organizationMemberships: OrganizationMemberOptionalDefaultsWithRelations[];
  invitationsSent: OrganizationInvitationOptionalDefaultsWithRelations[];
  invitationsAccepted: OrganizationInvitationOptionalDefaultsWithRelations[];
  fiscalDeclarations: FiscalDeclarationOptionalDefaultsWithRelations[];
  registrations: RegistrationOptionalDefaultsWithRelations[];
  guardedRegistrations: RegistrationOptionalDefaultsWithRelations[];
  reviewedRequirementOutcomes: RequirementOutcomeOptionalDefaultsWithRelations[];
  purchases: PurchaseOptionalDefaultsWithRelations[];
  reservations: ReservationOptionalDefaultsWithRelations[];
  passIssuances: PassIssuanceOptionalDefaultsWithRelations[];
  ticketTransfersFrom: TicketTransferOptionalDefaultsWithRelations[];
  ticketTransfersTo: TicketTransferOptionalDefaultsWithRelations[];
  checkIns: CheckInOptionalDefaultsWithRelations[];
};

export type UserOptionalDefaultsWithRelations = z.infer<typeof UserOptionalDefaultsSchema> & UserOptionalDefaultsRelations

export const UserOptionalDefaultsWithRelationsSchema: z.ZodType<UserOptionalDefaultsWithRelations> = UserOptionalDefaultsSchema.merge(z.object({
  logoFile: z.lazy(() => FileOptionalDefaultsWithRelationsSchema).nullish(),
  person: z.lazy(() => PersonOptionalDefaultsWithRelationsSchema),
  roles: z.lazy(() => RoleToUserOptionalDefaultsWithRelationsSchema).array(),
  logs: z.lazy(() => LogOptionalDefaultsWithRelationsSchema).array(),
  dancerProfile: z.lazy(() => DancerProfileOptionalDefaultsWithRelationsSchema).nullish(),
  organizationMemberships: z.lazy(() => OrganizationMemberOptionalDefaultsWithRelationsSchema).array(),
  invitationsSent: z.lazy(() => OrganizationInvitationOptionalDefaultsWithRelationsSchema).array(),
  invitationsAccepted: z.lazy(() => OrganizationInvitationOptionalDefaultsWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationOptionalDefaultsWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema).array(),
  guardedRegistrations: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema).array(),
  reviewedRequirementOutcomes: z.lazy(() => RequirementOutcomeOptionalDefaultsWithRelationsSchema).array(),
  purchases: z.lazy(() => PurchaseOptionalDefaultsWithRelationsSchema).array(),
  reservations: z.lazy(() => ReservationOptionalDefaultsWithRelationsSchema).array(),
  passIssuances: z.lazy(() => PassIssuanceOptionalDefaultsWithRelationsSchema).array(),
  ticketTransfersFrom: z.lazy(() => TicketTransferOptionalDefaultsWithRelationsSchema).array(),
  ticketTransfersTo: z.lazy(() => TicketTransferOptionalDefaultsWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// USER PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type UserPartialRelations = {
  logoFile?: FilePartialWithRelations | null;
  person?: PersonPartialWithRelations;
  roles?: RoleToUserPartialWithRelations[];
  logs?: LogPartialWithRelations[];
  dancerProfile?: DancerProfilePartialWithRelations | null;
  organizationMemberships?: OrganizationMemberPartialWithRelations[];
  invitationsSent?: OrganizationInvitationPartialWithRelations[];
  invitationsAccepted?: OrganizationInvitationPartialWithRelations[];
  fiscalDeclarations?: FiscalDeclarationPartialWithRelations[];
  registrations?: RegistrationPartialWithRelations[];
  guardedRegistrations?: RegistrationPartialWithRelations[];
  reviewedRequirementOutcomes?: RequirementOutcomePartialWithRelations[];
  purchases?: PurchasePartialWithRelations[];
  reservations?: ReservationPartialWithRelations[];
  passIssuances?: PassIssuancePartialWithRelations[];
  ticketTransfersFrom?: TicketTransferPartialWithRelations[];
  ticketTransfersTo?: TicketTransferPartialWithRelations[];
  checkIns?: CheckInPartialWithRelations[];
};

export type UserPartialWithRelations = z.infer<typeof UserPartialSchema> & UserPartialRelations

export const UserPartialWithRelationsSchema: z.ZodType<UserPartialWithRelations> = UserPartialSchema.merge(z.object({
  logoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  person: z.lazy(() => PersonPartialWithRelationsSchema),
  roles: z.lazy(() => RoleToUserPartialWithRelationsSchema).array(),
  logs: z.lazy(() => LogPartialWithRelationsSchema).array(),
  dancerProfile: z.lazy(() => DancerProfilePartialWithRelationsSchema).nullish(),
  organizationMemberships: z.lazy(() => OrganizationMemberPartialWithRelationsSchema).array(),
  invitationsSent: z.lazy(() => OrganizationInvitationPartialWithRelationsSchema).array(),
  invitationsAccepted: z.lazy(() => OrganizationInvitationPartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  guardedRegistrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  reviewedRequirementOutcomes: z.lazy(() => RequirementOutcomePartialWithRelationsSchema).array(),
  purchases: z.lazy(() => PurchasePartialWithRelationsSchema).array(),
  reservations: z.lazy(() => ReservationPartialWithRelationsSchema).array(),
  passIssuances: z.lazy(() => PassIssuancePartialWithRelationsSchema).array(),
  ticketTransfersFrom: z.lazy(() => TicketTransferPartialWithRelationsSchema).array(),
  ticketTransfersTo: z.lazy(() => TicketTransferPartialWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
})).partial()

export type UserOptionalDefaultsWithPartialRelations = z.infer<typeof UserOptionalDefaultsSchema> & UserPartialRelations

export const UserOptionalDefaultsWithPartialRelationsSchema: z.ZodType<UserOptionalDefaultsWithPartialRelations> = UserOptionalDefaultsSchema.merge(z.object({
  logoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  person: z.lazy(() => PersonPartialWithRelationsSchema),
  roles: z.lazy(() => RoleToUserPartialWithRelationsSchema).array(),
  logs: z.lazy(() => LogPartialWithRelationsSchema).array(),
  dancerProfile: z.lazy(() => DancerProfilePartialWithRelationsSchema).nullish(),
  organizationMemberships: z.lazy(() => OrganizationMemberPartialWithRelationsSchema).array(),
  invitationsSent: z.lazy(() => OrganizationInvitationPartialWithRelationsSchema).array(),
  invitationsAccepted: z.lazy(() => OrganizationInvitationPartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  guardedRegistrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  reviewedRequirementOutcomes: z.lazy(() => RequirementOutcomePartialWithRelationsSchema).array(),
  purchases: z.lazy(() => PurchasePartialWithRelationsSchema).array(),
  reservations: z.lazy(() => ReservationPartialWithRelationsSchema).array(),
  passIssuances: z.lazy(() => PassIssuancePartialWithRelationsSchema).array(),
  ticketTransfersFrom: z.lazy(() => TicketTransferPartialWithRelationsSchema).array(),
  ticketTransfersTo: z.lazy(() => TicketTransferPartialWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
}).partial())

export type UserWithPartialRelations = z.infer<typeof UserSchema> & UserPartialRelations

export const UserWithPartialRelationsSchema: z.ZodType<UserWithPartialRelations> = UserSchema.merge(z.object({
  logoFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  person: z.lazy(() => PersonPartialWithRelationsSchema),
  roles: z.lazy(() => RoleToUserPartialWithRelationsSchema).array(),
  logs: z.lazy(() => LogPartialWithRelationsSchema).array(),
  dancerProfile: z.lazy(() => DancerProfilePartialWithRelationsSchema).nullish(),
  organizationMemberships: z.lazy(() => OrganizationMemberPartialWithRelationsSchema).array(),
  invitationsSent: z.lazy(() => OrganizationInvitationPartialWithRelationsSchema).array(),
  invitationsAccepted: z.lazy(() => OrganizationInvitationPartialWithRelationsSchema).array(),
  fiscalDeclarations: z.lazy(() => FiscalDeclarationPartialWithRelationsSchema).array(),
  registrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  guardedRegistrations: z.lazy(() => RegistrationPartialWithRelationsSchema).array(),
  reviewedRequirementOutcomes: z.lazy(() => RequirementOutcomePartialWithRelationsSchema).array(),
  purchases: z.lazy(() => PurchasePartialWithRelationsSchema).array(),
  reservations: z.lazy(() => ReservationPartialWithRelationsSchema).array(),
  passIssuances: z.lazy(() => PassIssuancePartialWithRelationsSchema).array(),
  ticketTransfersFrom: z.lazy(() => TicketTransferPartialWithRelationsSchema).array(),
  ticketTransfersTo: z.lazy(() => TicketTransferPartialWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
}).partial())

export default UserSchema;
