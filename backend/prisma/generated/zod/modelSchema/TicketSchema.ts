import { z } from 'zod';
import { TicketStatusSchema } from '../inputTypeSchemas/TicketStatusSchema'
import { OrderLineWithRelationsSchema, OrderLinePartialWithRelationsSchema, OrderLineOptionalDefaultsWithRelationsSchema } from './OrderLineSchema'
import type { OrderLineWithRelations, OrderLinePartialWithRelations, OrderLineOptionalDefaultsWithRelations } from './OrderLineSchema'
import { PassIssuanceWithRelationsSchema, PassIssuancePartialWithRelationsSchema, PassIssuanceOptionalDefaultsWithRelationsSchema } from './PassIssuanceSchema'
import type { PassIssuanceWithRelations, PassIssuancePartialWithRelations, PassIssuanceOptionalDefaultsWithRelations } from './PassIssuanceSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { TicketTypeWithRelationsSchema, TicketTypePartialWithRelationsSchema, TicketTypeOptionalDefaultsWithRelationsSchema } from './TicketTypeSchema'
import type { TicketTypeWithRelations, TicketTypePartialWithRelations, TicketTypeOptionalDefaultsWithRelations } from './TicketTypeSchema'
import { RegistrationWithRelationsSchema, RegistrationPartialWithRelationsSchema, RegistrationOptionalDefaultsWithRelationsSchema } from './RegistrationSchema'
import type { RegistrationWithRelations, RegistrationPartialWithRelations, RegistrationOptionalDefaultsWithRelations } from './RegistrationSchema'
import { FileWithRelationsSchema, FilePartialWithRelationsSchema, FileOptionalDefaultsWithRelationsSchema } from './FileSchema'
import type { FileWithRelations, FilePartialWithRelations, FileOptionalDefaultsWithRelations } from './FileSchema'
import { TicketTransferWithRelationsSchema, TicketTransferPartialWithRelationsSchema, TicketTransferOptionalDefaultsWithRelationsSchema } from './TicketTransferSchema'
import type { TicketTransferWithRelations, TicketTransferPartialWithRelations, TicketTransferOptionalDefaultsWithRelations } from './TicketTransferSchema'
import { CheckInWithRelationsSchema, CheckInPartialWithRelationsSchema, CheckInOptionalDefaultsWithRelationsSchema } from './CheckInSchema'
import type { CheckInWithRelations, CheckInPartialWithRelations, CheckInOptionalDefaultsWithRelations } from './CheckInSchema'

/////////////////////////////////////////
// TICKET SCHEMA
/////////////////////////////////////////

/**
 * **L'esemplare acquistato**: nominale, trasferibile, con il suo QR (`09` §7).
 * 
 * Il biglietto è un titolo economico; l'iscrizione è la persona nell'evento con
 * il suo ruolo, i suoi requisiti e i suoi consumi di capienza. Sono due entità
 * distinte e non vanno accorpate: una persona può avere più biglietti e una sola
 * iscrizione.
 * 
 * ── Il QR (`AS-7`) ───────────────────────────────────────────────────────────
 * Payload firmato **Ed25519** in JWS compatto, con almeno
 * `{ ticketId, eventId, issuedAt, keyId }`. La chiave pubblica è distribuita con
 * il manifest di check-in perché la verifica deve funzionare **senza rete**; il
 * `keyId` esiste per la rotazione. Un QR non firmato è un QR falsificabile con
 * uno screenshot: non esiste una variante «semplificata» del requisito.
 * Il QR è **uno solo per biglietto**, non uno per sessione (`09` §7).
 * 
 * ── Il PDF (`RF-TCK-11`) ─────────────────────────────────────────────────────
 * `pdfFileId` punta a una **conferma d'ordine con QR di accesso, mai un titolo
 * fiscale**: nessuna numerazione progressiva, nessun sigillo, nessuna dicitura
 * che possa farlo apparire tale. È una delle tre condizioni che reggono il
 * posizionamento fiscale della piattaforma, non una scelta di copywriting.
 * 
 * ── Ciò che NON c'è, deliberatamente ─────────────────────────────────────────
 * Non esiste uno stato `USED`, e non deve esistere: l'utilizzo è registrato su
 * `CheckIn`, sulla coppia biglietto–sessione (`09` §7, §4.13).
 */
export const TicketSchema = z.object({
  status: TicketStatusSchema,
  id: z.number().int(),
  /**
   * Provenienza: riga d'ordine (vendita online) **oppure** emissione manuale.
   * Entrambe nullable e `SetNull`: un biglietto non sparisce né perde validità
   * perché l'ordine da cui nasce viene riorganizzato.
   */
  orderLineId: z.number().int().nullish(),
  passIssuanceId: z.number().int().nullish(),
  eventId: z.number().int(),
  ticketTypeId: z.number().int(),
  /**
   * L'iscrizione a cui il biglietto dà corpo. Nulla sui pass al portatore, che
   * non hanno una persona finché qualcuno non si presenta.
   */
  registrationId: z.number().int().nullish(),
  /**
   * Il contenuto del QR firmato. Unico e indicizzato: è la chiave di ricerca
   * di `POST /tickets/verify`.
   */
  code: z.string(),
  holderName: z.string(),
  holderSurname: z.string(),
  holderEmail: z.string().nullish(),
  /**
   * Pass emesso in blocco senza nominativo: **al portatore, non trasferibile**.
   */
  bearer: z.boolean(),
  qrIssuedAt: z.coerce.date(),
  /**
   * Valorizzato quando il QR è invalidato definitivamente (rimborso,
   * annullamento). Il TRASFERIMENTO non lo valorizza: emette un `code` nuovo,
   * e il precedente muore perché non corrisponde più ad alcun biglietto —
   * resta su `TicketTransfer.previousCode` come traccia storica.
   */
  qrRevokedAt: z.coerce.date().nullish(),
  pdfFileId: z.number().int().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Ticket = z.infer<typeof TicketSchema>

/////////////////////////////////////////
// TICKET PARTIAL SCHEMA
/////////////////////////////////////////

export const TicketPartialSchema = TicketSchema.partial()

export type TicketPartial = z.infer<typeof TicketPartialSchema>

/////////////////////////////////////////
// TICKET OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const TicketOptionalDefaultsSchema = TicketSchema.merge(z.object({
  status: TicketStatusSchema.optional(),
  id: z.number().int().optional(),
  /**
   * Pass emesso in blocco senza nominativo: **al portatore, non trasferibile**.
   */
  bearer: z.boolean().optional(),
  qrIssuedAt: z.coerce.date().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type TicketOptionalDefaults = z.infer<typeof TicketOptionalDefaultsSchema>

/////////////////////////////////////////
// TICKET RELATION SCHEMA
/////////////////////////////////////////

export type TicketRelations = {
  orderLine?: OrderLineWithRelations | null;
  passIssuance?: PassIssuanceWithRelations | null;
  event: EventWithRelations;
  ticketType: TicketTypeWithRelations;
  registration?: RegistrationWithRelations | null;
  pdfFile?: FileWithRelations | null;
  transfers: TicketTransferWithRelations[];
  checkIns: CheckInWithRelations[];
};

export type TicketWithRelations = z.infer<typeof TicketSchema> & TicketRelations

export const TicketWithRelationsSchema: z.ZodType<TicketWithRelations> = TicketSchema.merge(z.object({
  orderLine: z.lazy(() => OrderLineWithRelationsSchema).nullish(),
  passIssuance: z.lazy(() => PassIssuanceWithRelationsSchema).nullish(),
  event: z.lazy(() => EventWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypeWithRelationsSchema),
  registration: z.lazy(() => RegistrationWithRelationsSchema).nullish(),
  pdfFile: z.lazy(() => FileWithRelationsSchema).nullish(),
  transfers: z.lazy(() => TicketTransferWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// TICKET OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type TicketOptionalDefaultsRelations = {
  orderLine?: OrderLineOptionalDefaultsWithRelations | null;
  passIssuance?: PassIssuanceOptionalDefaultsWithRelations | null;
  event: EventOptionalDefaultsWithRelations;
  ticketType: TicketTypeOptionalDefaultsWithRelations;
  registration?: RegistrationOptionalDefaultsWithRelations | null;
  pdfFile?: FileOptionalDefaultsWithRelations | null;
  transfers: TicketTransferOptionalDefaultsWithRelations[];
  checkIns: CheckInOptionalDefaultsWithRelations[];
};

export type TicketOptionalDefaultsWithRelations = z.infer<typeof TicketOptionalDefaultsSchema> & TicketOptionalDefaultsRelations

export const TicketOptionalDefaultsWithRelationsSchema: z.ZodType<TicketOptionalDefaultsWithRelations> = TicketOptionalDefaultsSchema.merge(z.object({
  orderLine: z.lazy(() => OrderLineOptionalDefaultsWithRelationsSchema).nullish(),
  passIssuance: z.lazy(() => PassIssuanceOptionalDefaultsWithRelationsSchema).nullish(),
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypeOptionalDefaultsWithRelationsSchema),
  registration: z.lazy(() => RegistrationOptionalDefaultsWithRelationsSchema).nullish(),
  pdfFile: z.lazy(() => FileOptionalDefaultsWithRelationsSchema).nullish(),
  transfers: z.lazy(() => TicketTransferOptionalDefaultsWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// TICKET PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type TicketPartialRelations = {
  orderLine?: OrderLinePartialWithRelations | null;
  passIssuance?: PassIssuancePartialWithRelations | null;
  event?: EventPartialWithRelations;
  ticketType?: TicketTypePartialWithRelations;
  registration?: RegistrationPartialWithRelations | null;
  pdfFile?: FilePartialWithRelations | null;
  transfers?: TicketTransferPartialWithRelations[];
  checkIns?: CheckInPartialWithRelations[];
};

export type TicketPartialWithRelations = z.infer<typeof TicketPartialSchema> & TicketPartialRelations

export const TicketPartialWithRelationsSchema: z.ZodType<TicketPartialWithRelations> = TicketPartialSchema.merge(z.object({
  orderLine: z.lazy(() => OrderLinePartialWithRelationsSchema).nullish(),
  passIssuance: z.lazy(() => PassIssuancePartialWithRelationsSchema).nullish(),
  event: z.lazy(() => EventPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema).nullish(),
  pdfFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  transfers: z.lazy(() => TicketTransferPartialWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
})).partial()

export type TicketOptionalDefaultsWithPartialRelations = z.infer<typeof TicketOptionalDefaultsSchema> & TicketPartialRelations

export const TicketOptionalDefaultsWithPartialRelationsSchema: z.ZodType<TicketOptionalDefaultsWithPartialRelations> = TicketOptionalDefaultsSchema.merge(z.object({
  orderLine: z.lazy(() => OrderLinePartialWithRelationsSchema).nullish(),
  passIssuance: z.lazy(() => PassIssuancePartialWithRelationsSchema).nullish(),
  event: z.lazy(() => EventPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema).nullish(),
  pdfFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  transfers: z.lazy(() => TicketTransferPartialWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
}).partial())

export type TicketWithPartialRelations = z.infer<typeof TicketSchema> & TicketPartialRelations

export const TicketWithPartialRelationsSchema: z.ZodType<TicketWithPartialRelations> = TicketSchema.merge(z.object({
  orderLine: z.lazy(() => OrderLinePartialWithRelationsSchema).nullish(),
  passIssuance: z.lazy(() => PassIssuancePartialWithRelationsSchema).nullish(),
  event: z.lazy(() => EventPartialWithRelationsSchema),
  ticketType: z.lazy(() => TicketTypePartialWithRelationsSchema),
  registration: z.lazy(() => RegistrationPartialWithRelationsSchema).nullish(),
  pdfFile: z.lazy(() => FilePartialWithRelationsSchema).nullish(),
  transfers: z.lazy(() => TicketTransferPartialWithRelationsSchema).array(),
  checkIns: z.lazy(() => CheckInPartialWithRelationsSchema).array(),
}).partial())

export default TicketSchema;
