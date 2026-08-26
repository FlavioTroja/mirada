import { z } from 'zod';
import { SalesChannelWithRelationsSchema, SalesChannelPartialWithRelationsSchema, SalesChannelOptionalDefaultsWithRelationsSchema } from './SalesChannelSchema'
import type { SalesChannelWithRelations, SalesChannelPartialWithRelations, SalesChannelOptionalDefaultsWithRelations } from './SalesChannelSchema'

/////////////////////////////////////////
// SALES CHANNEL DEPOSIT CODE SCHEMA
/////////////////////////////////////////

/**
 * I codici sconto che, **sul negozio**, significano «acconto» (`14` §3.1,
 * `RF-SAL-1`).
 * 
 * ── Perché è configurazione e non codice ────────────────────────────────────
 * International Trani Tango vende con `ACCONTO_30`; esistono già varianti e ne
 * esisteranno altre — `ACCONTO_50`, codici per edizione, codici per pacchetto.
 * Un `if (code === "ACCONTO_30")` sarebbe una modifica al software a ogni
 * edizione, e un giorno la modifica non verrebbe fatta: la vendita entrerebbe
 * come se fosse a prezzo pieno, il residuo non nascerebbe, e al botteghino
 * nessuno chiederebbe quei centoventi euro.
 * 
 * ── La percentuale NON è qui, ed è deliberato ───────────────────────────────
 * Il codice **marca** la vendita come acconto; a dire quanto manca è l'importo
 * che quel codice ha scontato, che il negozio consegna esatto per riga. Il `30`
 * nel nome è un'etichetta per gli umani: il giorno in cui l'organizzatore
 * cambierà la percentuale del codice senza rinominarlo, un calcolo fondato sul
 * nome sbaglierebbe in silenzio.
 */
export const SalesChannelDepositCodeSchema = z.object({
  id: z.number().int(),
  salesChannelId: z.number().int(),
  /**
   * Il codice **normalizzato** — maiuscolo, senza spazi (`RF-SAL-2`). È la
   * forma su cui si confronta, e si normalizza in scrittura perché confrontare
   * normalizzando a ogni lettura sarebbe la stessa regola scritta in due posti.
   * 
   * Il difetto che la normalizzazione evita è muto: un codice applicato a mano
   * dal back-office del negozio con una capitalizzazione diversa non verrebbe
   * riconosciuto come acconto. Nessun errore, nessuna quarantena, nessun
   * segnale. Se ne accorge il commercialista a settembre.
   */
  code: z.string(),
  /**
   * Come l'organizzatore lo chiama — «Acconto 30%». Serve a lui, non al calcolo.
   */
  label: z.string(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type SalesChannelDepositCode = z.infer<typeof SalesChannelDepositCodeSchema>

/////////////////////////////////////////
// SALES CHANNEL DEPOSIT CODE PARTIAL SCHEMA
/////////////////////////////////////////

export const SalesChannelDepositCodePartialSchema = SalesChannelDepositCodeSchema.partial()

export type SalesChannelDepositCodePartial = z.infer<typeof SalesChannelDepositCodePartialSchema>

/////////////////////////////////////////
// SALES CHANNEL DEPOSIT CODE OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const SalesChannelDepositCodeOptionalDefaultsSchema = SalesChannelDepositCodeSchema.merge(z.object({
  id: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type SalesChannelDepositCodeOptionalDefaults = z.infer<typeof SalesChannelDepositCodeOptionalDefaultsSchema>

/////////////////////////////////////////
// SALES CHANNEL DEPOSIT CODE RELATION SCHEMA
/////////////////////////////////////////

export type SalesChannelDepositCodeRelations = {
  salesChannel: SalesChannelWithRelations;
};

export type SalesChannelDepositCodeWithRelations = z.infer<typeof SalesChannelDepositCodeSchema> & SalesChannelDepositCodeRelations

export const SalesChannelDepositCodeWithRelationsSchema: z.ZodType<SalesChannelDepositCodeWithRelations> = SalesChannelDepositCodeSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelWithRelationsSchema),
}))

/////////////////////////////////////////
// SALES CHANNEL DEPOSIT CODE OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type SalesChannelDepositCodeOptionalDefaultsRelations = {
  salesChannel: SalesChannelOptionalDefaultsWithRelations;
};

export type SalesChannelDepositCodeOptionalDefaultsWithRelations = z.infer<typeof SalesChannelDepositCodeOptionalDefaultsSchema> & SalesChannelDepositCodeOptionalDefaultsRelations

export const SalesChannelDepositCodeOptionalDefaultsWithRelationsSchema: z.ZodType<SalesChannelDepositCodeOptionalDefaultsWithRelations> = SalesChannelDepositCodeOptionalDefaultsSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// SALES CHANNEL DEPOSIT CODE PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type SalesChannelDepositCodePartialRelations = {
  salesChannel?: SalesChannelPartialWithRelations;
};

export type SalesChannelDepositCodePartialWithRelations = z.infer<typeof SalesChannelDepositCodePartialSchema> & SalesChannelDepositCodePartialRelations

export const SalesChannelDepositCodePartialWithRelationsSchema: z.ZodType<SalesChannelDepositCodePartialWithRelations> = SalesChannelDepositCodePartialSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
})).partial()

export type SalesChannelDepositCodeOptionalDefaultsWithPartialRelations = z.infer<typeof SalesChannelDepositCodeOptionalDefaultsSchema> & SalesChannelDepositCodePartialRelations

export const SalesChannelDepositCodeOptionalDefaultsWithPartialRelationsSchema: z.ZodType<SalesChannelDepositCodeOptionalDefaultsWithPartialRelations> = SalesChannelDepositCodeOptionalDefaultsSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
}).partial())

export type SalesChannelDepositCodeWithPartialRelations = z.infer<typeof SalesChannelDepositCodeSchema> & SalesChannelDepositCodePartialRelations

export const SalesChannelDepositCodeWithPartialRelationsSchema: z.ZodType<SalesChannelDepositCodeWithPartialRelations> = SalesChannelDepositCodeSchema.merge(z.object({
  salesChannel: z.lazy(() => SalesChannelPartialWithRelationsSchema),
}).partial())

export default SalesChannelDepositCodeSchema;
