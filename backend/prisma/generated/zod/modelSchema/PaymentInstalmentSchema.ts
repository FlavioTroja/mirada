import { z } from 'zod';
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'

/////////////////////////////////////////
// PAYMENT INSTALMENT SCHEMA
/////////////////////////////////////////

/**
 * **Una rata attesa** — `18-rate.md` §3.
 * 
 * La scuola concorda con l'allievo «tre rate da 60 €, il 1° di ottobre,
 * novembre e dicembre», e queste sono quelle tre righe.
 * 
 * ── ⚠️ Non ha uno stato «pagata», ed è la regola di questa tabella (`RB34`) ──
 * Il piano è una **previsione**; i fatti sono le righe di `BalanceSettlement`.
 * Chi è in ritardo si ottiene confrontando i due — «somma delle rate già
 * scadute meno totale versato» — non leggendo una spunta.
 * 
 * Una spunta sarebbe un terzo posto in cui vive la stessa verità, e prima o poi
 * direbbe una cosa diversa dagli altri due. È lo stesso ragionamento di
 * `CheckIn` (l'utilizzo non è uno stato del biglietto, `09` §7), di
 * `Registration.balanceSettledAmount` (la somma delle righe, `14` §5.2) e di
 * `CapacityQuota.consumed`.
 * 
 * E toglie di mezzo una domanda senza risposta: se si versano 50 € su una rata
 * da 60, quella rata è «pagata»? Col confronto la domanda non si pone — alla
 * data di quella rata mancano dieci euro, ed è tutto ciò che serve sapere.
 * 
 * ── Nessun legame con il singolo versamento (§3.3) ──────────────────────────
 * `BalanceSettlement` non punta a una rata. Chiedere all'operatore, con i soldi
 * in mano, **a quale rata** attribuire ciò che sta incassando è una domanda che
 * non ha una risposta giusta e che rallenta uno sportello. Il denaro copre il
 * piano nell'ordine delle scadenze.
 */
export const PaymentInstalmentSchema = z.object({
  id: z.number().int(),
  registrationId: z.number().int(),
  /**
   * Centesimi interi (§3.1). La somma delle rate di un'iscrizione è
   * **esattamente** il suo `balanceDueAmount` (`RB35`): il vincolo è del
   * servizio, perché è lì che le due grandezze si vedono insieme.
   */
  amount: z.number().int(),
  /**
   * Quando quella rata era attesa. È l'unico dato che il residuo aperto, da
   * solo, non sa dare — ed è la ragione per cui questa tabella esiste.
   */
  dueAt: z.coerce.date(),
  /**
   * L'ordine concordato. Due rate possono cadere lo stesso giorno.
   */
  sortOrder: z.number().int(),
  /**
   * Quello che la segreteria vuole lasciare scritto: «la terza la porta a
   * gennaio, d'accordo con l'insegnante».
   */
  note: z.string().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type PaymentInstalment = z.infer<typeof PaymentInstalmentSchema>

/////////////////////////////////////////
// PAYMENT INSTALMENT PARTIAL SCHEMA
/////////////////////////////////////////

export const PaymentInstalmentPartialSchema = PaymentInstalmentSchema.partial()

export type PaymentInstalmentPartial = z.infer<typeof PaymentInstalmentPartialSchema>

/////////////////////////////////////////
// PAYMENT INSTALMENT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const PaymentInstalmentOptionalDefaultsSchema = PaymentInstalmentSchema.merge(z.object({
  id: z.number().int().optional(),
  /**
   * L'ordine concordato. Due rate possono cadere lo stesso giorno.
   */
  sortOrder: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type PaymentInstalmentOptionalDefaults = z.infer<typeof PaymentInstalmentOptionalDefaultsSchema>

/////////////////////////////////////////
// PAYMENT INSTALMENT RELATION SCHEMA
/////////////////////////////////////////

export type PaymentInstalmentRelations = {
  registration: RegistrationWithRelations;
};

export type PaymentInstalmentWithRelations = z.infer<typeof PaymentInstalmentSchema> & PaymentInstalmentRelations

export const PaymentInstalmentWithRelationsSchema: z.ZodType<PaymentInstalmentWithRelations> = PaymentInstalmentSchema.merge(z.object({
  registration: z.lazy(() => RegistrationWithRelationsSchema),
}))

/////////////////////////////////////////
// PAYMENT INSTALMENT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type PaymentInstalmentOptionalDefaultsRelations = {
  registration: RegistrationOptionalDefaultsWithRelations;
};

export type PaymentInstalmentOptionalDefaultsWithRelations = z.infer<typeof PaymentInstalmentOptionalDefaultsSchema> & PaymentInstalmentOptionalDefaultsRelations

export const PaymentInstalmentOptionalDefaultsWithRelationsSchema: z.ZodType<PaymentInstalmentOptionalDefaultsWithRelations> = PaymentInstalmentOptionalDefaultsSchema.merge(z.object({
  registration: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// PAYMENT INSTALMENT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type PaymentInstalmentPartialRelations = {
  registration?: RegistrationPartialWithRelations;
};

export type PaymentInstalmentPartialWithRelations = z.infer<typeof PaymentInstalmentPartialSchema> & PaymentInstalmentPartialRelations

export const PaymentInstalmentPartialWithRelationsSchema: z.ZodType<PaymentInstalmentPartialWithRelations> = PaymentInstalmentPartialSchema.merge(z.object({
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
})).partial()

export type PaymentInstalmentOptionalDefaultsWithPartialRelations = z.infer<typeof PaymentInstalmentOptionalDefaultsSchema> & PaymentInstalmentPartialRelations

export const PaymentInstalmentOptionalDefaultsWithPartialRelationsSchema: z.ZodType<PaymentInstalmentOptionalDefaultsWithPartialRelations> = PaymentInstalmentOptionalDefaultsSchema.merge(z.object({
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
}).partial())

export type PaymentInstalmentWithPartialRelations = z.infer<typeof PaymentInstalmentSchema> & PaymentInstalmentPartialRelations

export const PaymentInstalmentWithPartialRelationsSchema: z.ZodType<PaymentInstalmentWithPartialRelations> = PaymentInstalmentSchema.merge(z.object({
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema),
}).partial())

export default PaymentInstalmentSchema;
