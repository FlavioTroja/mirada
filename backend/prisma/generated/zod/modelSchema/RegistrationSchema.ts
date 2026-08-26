import { z } from 'zod';
import { DeclaredDanceRoleSchema } from '../inputTypeSchemas/DeclaredDanceRoleSchema'
import { DanceRoleSchema } from '../inputTypeSchemas/DanceRoleSchema'
import { RegistrationChannelSchema } from '../inputTypeSchemas/RegistrationChannelSchema'
import { RegistrationStatusSchema } from '../inputTypeSchemas/RegistrationStatusSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'
import { CoupleWithRelationsSchema, CouplePartialWithRelationsSchema, CoupleOptionalDefaultsWithRelationsSchema } from './CoupleSchema'
import type { CoupleWithRelations, CouplePartialWithRelations, CoupleOptionalDefaultsWithRelations } from './CoupleSchema'
import { ExternalSaleWithRelationsSchema, ExternalSalePartialWithRelationsSchema, ExternalSaleOptionalDefaultsWithRelationsSchema } from './ExternalSaleSchema'
import type { ExternalSaleWithRelations, ExternalSalePartialWithRelations, ExternalSaleOptionalDefaultsWithRelations } from './ExternalSaleSchema'
import { QuotaConsumptionWithRelationsSchema, QuotaConsumptionPartialWithRelationsSchema, QuotaConsumptionOptionalDefaultsWithRelationsSchema } from './QuotaConsumptionSchema'
import type { QuotaConsumptionWithRelations, QuotaConsumptionPartialWithRelations, QuotaConsumptionOptionalDefaultsWithRelations } from './QuotaConsumptionSchema'
import { RequirementOutcomeWithRelationsSchema, RequirementOutcomePartialWithRelationsSchema, RequirementOutcomeOptionalDefaultsWithRelationsSchema } from './RequirementOutcomeSchema'
import type { RequirementOutcomeWithRelations, RequirementOutcomePartialWithRelations, RequirementOutcomeOptionalDefaultsWithRelations } from './RequirementOutcomeSchema'
import { TicketWithRelationsSchema, TicketPartialWithRelationsSchema, TicketOptionalDefaultsWithRelationsSchema } from './TicketSchema'
import type { TicketWithRelations, TicketPartialWithRelations, TicketOptionalDefaultsWithRelations } from './TicketSchema'
import { CheckInWithRelationsSchema, CheckInPartialWithRelationsSchema, CheckInOptionalDefaultsWithRelationsSchema } from './CheckInSchema'
import type { CheckInWithRelations, CheckInPartialWithRelations, CheckInOptionalDefaultsWithRelations } from './CheckInSchema'
import { BalanceSettlementWithRelationsSchema, BalanceSettlementPartialWithRelationsSchema, BalanceSettlementOptionalDefaultsWithRelationsSchema } from './BalanceSettlementSchema'
import type { BalanceSettlementWithRelations, BalanceSettlementPartialWithRelations, BalanceSettlementOptionalDefaultsWithRelations } from './BalanceSettlementSchema'

/////////////////////////////////////////
// REGISTRATION SCHEMA
/////////////////////////////////////////

/**
 * Una iscrizione per persona per evento, con più biglietti collegati.
 * `assignedRole` è CALCOLATO DAL SERVER (§5): il DTO `Update` non lo accetta,
 * la riassegnazione passa dal servizio che rilascia i consumi del vecchio ruolo
 * e impegna quelli del nuovo con le stesse verifiche di un acquisto.
 */
export const RegistrationSchema = z.object({
  /**
   * Ciò che l'utente ha scelto.
   */
  declaredRole: DeclaredDanceRoleSchema,
  /**
   * Il ruolo effettivo, risolto alla conferma del pagamento. Mai nullo su
   * eventi con quote di ruolo (`05` §2.3, invariante I4).
   */
  assignedRole: DanceRoleSchema.nullish(),
  channel: RegistrationChannelSchema,
  status: RegistrationStatusSchema,
  id: z.number().int(),
  eventId: z.number().int(),
  personUserId: z.number().int().nullish(),
  holderName: z.string(),
  holderSurname: z.string(),
  holderEmail: z.string(),
  confirmedAt: z.coerce.date().nullish(),
  declinedAt: z.coerce.date().nullish(),
  coupleId: z.number().int().nullish(),
  isMinor: z.boolean(),
  guardianUserId: z.number().int().nullish(),
  /**
   * La vendita su canale esterno da cui l'iscrizione proviene. Nulla su tutte
   * le altre — vendita online, porta, accredito.
   */
  externalSaleId: z.number().int().nullish(),
  /**
   * ── Il residuo di questa persona (`14` §5.1, `RF-SAL-7`) ─────────────────
   * Centesimi interi. `0` su tutte le iscrizioni che non nascono da un acconto,
   * che oggi sono la quasi totalità.
   * 
   * **Sta qui e non sulla vendita** per tre ragioni, in ordine: al botteghino si
   * presentano persone e non ordini; il giorno in cui a generare il residuo sarà
   * un `Order` con Stripe (fase D2) non cambia una riga a valle; e sopravvive
   * alla rielaborazione della vendita, che è un'operazione normale.
   * 
   * `balanceDueAmount` è **quanto è nato** e non si muove più.
   */
  balanceDueAmount: z.number().int(),
  /**
   * **Quanto ne è stato saldato**, ed è un contatore: si muove SOLO attraverso
   * `BalanceSettlementService`, mai da un DTO di aggiornamento — esattamente
   * come `CapacityQuota.consumed`, e per la stessa ragione (`14` §5.2).
   * Il residuo ancora aperto è la differenza fra i due.
   */
  balanceSettledAmount: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Registration = z.infer<typeof RegistrationSchema>

/////////////////////////////////////////
// REGISTRATION PARTIAL SCHEMA
/////////////////////////////////////////

export const RegistrationPartialSchema = RegistrationSchema.partial()

export type RegistrationPartial = z.infer<typeof RegistrationPartialSchema>

/////////////////////////////////////////
// REGISTRATION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const RegistrationOptionalDefaultsSchema = RegistrationSchema.merge(z.object({
  channel: RegistrationChannelSchema.optional(),
  status: RegistrationStatusSchema.optional(),
  id: z.number().int().optional(),
  isMinor: z.boolean().optional(),
  /**
   * ── Il residuo di questa persona (`14` §5.1, `RF-SAL-7`) ─────────────────
   * Centesimi interi. `0` su tutte le iscrizioni che non nascono da un acconto,
   * che oggi sono la quasi totalità.
   * 
   * **Sta qui e non sulla vendita** per tre ragioni, in ordine: al botteghino si
   * presentano persone e non ordini; il giorno in cui a generare il residuo sarà
   * un `Order` con Stripe (fase D2) non cambia una riga a valle; e sopravvive
   * alla rielaborazione della vendita, che è un'operazione normale.
   * 
   * `balanceDueAmount` è **quanto è nato** e non si muove più.
   */
  balanceDueAmount: z.number().int().optional(),
  /**
   * **Quanto ne è stato saldato**, ed è un contatore: si muove SOLO attraverso
   * `BalanceSettlementService`, mai da un DTO di aggiornamento — esattamente
   * come `CapacityQuota.consumed`, e per la stessa ragione (`14` §5.2).
   * Il residuo ancora aperto è la differenza fra i due.
   */
  balanceSettledAmount: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type RegistrationOptionalDefaults = z.infer<typeof RegistrationOptionalDefaultsSchema>

/////////////////////////////////////////
// REGISTRATION RELATION SCHEMA
/////////////////////////////////////////

export type RegistrationRelations = {
  event: EventWithRelations;
  personUser?: UserWithRelations | null;
  couple?: CoupleWithRelations | null;
  guardian?: UserWithRelations | null;
  externalSale?: ExternalSaleWithRelations | null;
  quotaConsumptions: QuotaConsumptionWithRelations[];
  requirementOutcomes: RequirementOutcomeWithRelations[];
  tickets: TicketWithRelations[];
  checkIns: CheckInWithRelations[];
  balanceSettlements: BalanceSettlementWithRelations[];
};

export type RegistrationWithRelations = z.infer<typeof RegistrationSchema> & RegistrationRelations

export const RegistrationWithRelationsSchema: z.ZodType<RegistrationWithRelations> = RegistrationSchema.merge(z.object({
  event: z.lazy(() => EventWithRelationsSchema),
  personUser: z.lazy(() => UserWithRelationsSchema).nullish(),
  couple: z.lazy(() => CoupleWithRelationsSchema).nullish(),
  guardian: z.lazy(() => UserWithRelationsSchema).nullish(),
  externalSale: z.lazy(() => ExternalSaleWithRelationsSchema).nullish(),
  quotaConsumptions: z.lazy(() => QuotaConsumptionWithRelationsSchema).array(),
  requirementOutcomes: z.lazy(() => RequirementOutcomeWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInWithRelationsSchema).array(),
  balanceSettlements: z.lazy(() => BalanceSettlementWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// REGISTRATION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type RegistrationOptionalDefaultsRelations = {
  event: EventOptionalDefaultsWithRelations;
  personUser?: UserOptionalDefaultsWithRelations | null;
  couple?: CoupleOptionalDefaultsWithRelations | null;
  guardian?: UserOptionalDefaultsWithRelations | null;
  externalSale?: ExternalSaleOptionalDefaultsWithRelations | null;
  quotaConsumptions: QuotaConsumptionOptionalDefaultsWithRelations[];
  requirementOutcomes: RequirementOutcomeOptionalDefaultsWithRelations[];
  tickets: TicketOptionalDefaultsWithRelations[];
  checkIns: CheckInOptionalDefaultsWithRelations[];
  balanceSettlements: BalanceSettlementOptionalDefaultsWithRelations[];
};

export type RegistrationOptionalDefaultsWithRelations = z.infer<typeof RegistrationOptionalDefaultsSchema> & RegistrationOptionalDefaultsRelations

export const RegistrationOptionalDefaultsWithRelationsSchema: z.ZodType<RegistrationOptionalDefaultsWithRelations> = RegistrationOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  personUser: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullish(),
  couple: z.lazy(() => CoupleOptionalDefaultsWithRelationsSchema).nullish(),
  guardian: z.lazy(() => UserOptionalDefaultsWithRelationsSchema).nullish(),
  externalSale: z.lazy(() => ExternalSaleOptionalDefaultsWithRelationsSchema).nullish(),
  quotaConsumptions: z.lazy(() => QuotaConsumptionOptionalDefaultsWithRelationsSchema).array(),
  requirementOutcomes: z.lazy(() => RequirementOutcomeOptionalDefaultsWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketOptionalDefaultsWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInOptionalDefaultsWithRelationsSchema).array(),
  balanceSettlements: z.lazy(() => BalanceSettlementOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// REGISTRATION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type RegistrationPartialRelations = {
  event?: EventPartialWithRelations;
  personUser?: UserPartialWithRelations | null;
  couple?: CouplePartialWithRelations | null;
  guardian?: UserPartialWithRelations | null;
  externalSale?: ExternalSalePartialWithRelations | null;
  quotaConsumptions?: QuotaConsumptionPartialWithRelations[];
  requirementOutcomes?: RequirementOutcomePartialWithRelations[];
  tickets?: TicketPartialWithRelations[];
  checkIns?: CheckInPartialWithRelations[];
  balanceSettlements?: BalanceSettlementPartialWithRelations[];
};

export type RegistrationPartialWithRelations = z.infer<typeof RegistrationPartialSchema> & RegistrationPartialRelations

export const RegistrationPartialWithRelationsSchema: z.ZodType<RegistrationPartialWithRelations> = RegistrationPartialSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  personUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  couple: z.lazy(() => CouplePartialWithRelationsSchema).nullish(),
  guardian: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  externalSale: z.lazy(() => ExternalSalePartialWithRelationsSchema).nullish(),
  quotaConsumptions: z.lazy(() => QuotaConsumptionPartialWithRelationsSchema).array(),
  requirementOutcomes: z.lazy(() => RequirementOutcomePartialWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
  balanceSettlements: z.lazy(() => BalanceSettlementPartialWithRelationsSchema).array(),
})).partial()

export type RegistrationOptionalDefaultsWithPartialRelations = z.infer<typeof RegistrationOptionalDefaultsSchema> & RegistrationPartialRelations

export const RegistrationOptionalDefaultsWithPartialRelationsSchema: z.ZodType<RegistrationOptionalDefaultsWithPartialRelations> = RegistrationOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  personUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  couple: z.lazy(() => CouplePartialWithRelationsSchema).nullish(),
  guardian: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  externalSale: z.lazy(() => ExternalSalePartialWithRelationsSchema).nullish(),
  quotaConsumptions: z.lazy(() => QuotaConsumptionPartialWithRelationsSchema).array(),
  requirementOutcomes: z.lazy(() => RequirementOutcomePartialWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
  balanceSettlements: z.lazy(() => BalanceSettlementPartialWithRelationsSchema).array(),
}).partial())

export type RegistrationWithPartialRelations = z.infer<typeof RegistrationSchema> & RegistrationPartialRelations

export const RegistrationWithPartialRelationsSchema: z.ZodType<RegistrationWithPartialRelations> = RegistrationSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  personUser: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  couple: z.lazy(() => CouplePartialWithRelationsSchema).nullish(),
  guardian: z.lazy(() => UserPartialWithRelationsSchema).nullish(),
  externalSale: z.lazy(() => ExternalSalePartialWithRelationsSchema).nullish(),
  quotaConsumptions: z.lazy(() => QuotaConsumptionPartialWithRelationsSchema).array(),
  requirementOutcomes: z.lazy(() => RequirementOutcomePartialWithRelationsSchema).array(),
  tickets: z.lazy(() => TicketPartialWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
  balanceSettlements: z.lazy(() => BalanceSettlementPartialWithRelationsSchema).array(),
}).partial())

export default RegistrationSchema;
