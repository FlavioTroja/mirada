import { z } from 'zod';
import { ActivityKindSchema } from '../inputTypeSchemas/ActivityKindSchema'
import { ActivitySeveritySchema } from '../inputTypeSchemas/ActivitySeveritySchema'
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'

/////////////////////////////////////////
// ACTIVITY SCHEMA
/////////////////////////////////////////

/**
 * **Che cosa è successo, per un'organizzazione** — la colonna «In tempo reale»
 * e il «Registro di oggi» della Dashboard (`21-dashboard.md` §4).
 * 
 * Esiste perché `Log` non ha organizzazione e `log/notification` va a tutta la
 * piattaforma per ruolo: usarlo mostrerebbe a una scuola le azioni di un'altra.
 * 
 * È la cronaca recente, non l'archivio: le righe oltre 30 giorni si cancellano.
 * Il testo è già in italiano e già composto, perché una riga d'attività non
 * cambia significato dopo: «Ingresso di Sara Pugliese · Milonga di gala».
 */
export const ActivitySchema = z.object({
  kind: ActivityKindSchema,
  severity: ActivitySeveritySchema,
  id: z.number().int(),
  organizationId: z.number().int(),
  text: z.string(),
  /**
   * Chi l'ha fatto, quando è una persona dello staff: «Marco T.».
   */
  actorName: z.string().nullish(),
  /**
   * Un'azione dello staff (una lezione aggiunta, un evento pubblicato): il
   * «Registro di oggi» mostra solo queste.
   */
  staff: z.boolean(),
  /**
   * Centesimi, solo per gli incassi.
   */
  amount: z.number().int().nullish(),
  eventId: z.number().int().nullish(),
  createdAt: z.coerce.date(),
})

export type Activity = z.infer<typeof ActivitySchema>

/////////////////////////////////////////
// ACTIVITY PARTIAL SCHEMA
/////////////////////////////////////////

export const ActivityPartialSchema = ActivitySchema.partial()

export type ActivityPartial = z.infer<typeof ActivityPartialSchema>

/////////////////////////////////////////
// ACTIVITY OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const ActivityOptionalDefaultsSchema = ActivitySchema.merge(z.object({
  severity: ActivitySeveritySchema.optional(),
  id: z.number().int().optional(),
  /**
   * Un'azione dello staff (una lezione aggiunta, un evento pubblicato): il
   * «Registro di oggi» mostra solo queste.
   */
  staff: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
}))

export type ActivityOptionalDefaults = z.infer<typeof ActivityOptionalDefaultsSchema>

/////////////////////////////////////////
// ACTIVITY RELATION SCHEMA
/////////////////////////////////////////

export type ActivityRelations = {
  organization: OrganizationWithRelations;
};

export type ActivityWithRelations = z.infer<typeof ActivitySchema> & ActivityRelations

export const ActivityWithRelationsSchema: z.ZodType<ActivityWithRelations> = ActivitySchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
}))

/////////////////////////////////////////
// ACTIVITY OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type ActivityOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
};

export type ActivityOptionalDefaultsWithRelations = z.infer<typeof ActivityOptionalDefaultsSchema> & ActivityOptionalDefaultsRelations

export const ActivityOptionalDefaultsWithRelationsSchema: z.ZodType<ActivityOptionalDefaultsWithRelations> = ActivityOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// ACTIVITY PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type ActivityPartialRelations = {
  organization?: OrganizationPartialWithRelations;
};

export type ActivityPartialWithRelations = z.infer<typeof ActivityPartialSchema> & ActivityPartialRelations

export const ActivityPartialWithRelationsSchema: z.ZodType<ActivityPartialWithRelations> = ActivityPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
})).partial()

export type ActivityOptionalDefaultsWithPartialRelations = z.infer<typeof ActivityOptionalDefaultsSchema> & ActivityPartialRelations

export const ActivityOptionalDefaultsWithPartialRelationsSchema: z.ZodType<ActivityOptionalDefaultsWithPartialRelations> = ActivityOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
}).partial())

export type ActivityWithPartialRelations = z.infer<typeof ActivitySchema> & ActivityPartialRelations

export const ActivityWithPartialRelationsSchema: z.ZodType<ActivityWithPartialRelations> = ActivitySchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
}).partial())

export default ActivitySchema;
