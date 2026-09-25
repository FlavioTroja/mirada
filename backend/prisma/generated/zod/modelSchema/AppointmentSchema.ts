import { z } from 'zod';
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { VenueWithRelationsSchema, VenuePartialWithRelationsSchema, VenueOptionalDefaultsWithRelationsSchema } from './VenueSchema'
import type { VenueWithRelations, VenuePartialWithRelations, VenueOptionalDefaultsWithRelations } from './VenueSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// APPOINTMENT SCHEMA
/////////////////////////////////////////

/**
 * **Un impegno dello staff che non è una lezione né un evento**: la riunione,
 * le prove, la sala chiusa per pulizie (`20-calendario.md` §4.2).
 * 
 * Non va mai in pubblico, ed è per questo che `title` è testo semplice e non
 * `I18nText`. Come le sessioni, una ripetizione genera righe vere legate da
 * `seriesId`.
 */
export const AppointmentSchema = z.object({
  id: z.number().int(),
  organizationId: z.number().int(),
  title: z.string(),
  note: z.string().nullish(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  /**
   * Tutto il giorno: `startAt`/`endAt` sono la mezzanotte locale del primo
   * giorno e quella successiva all'ultimo, e la griglia li mette nella fascia alta.
   */
  allDay: z.boolean(),
  /**
   * La sede, facoltativa, dalla rubrica dell'organizzazione o di piattaforma.
   */
  venueId: z.number().int().nullish(),
  room: z.string().nullish(),
  seriesId: z.string().nullish(),
  createdById: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Appointment = z.infer<typeof AppointmentSchema>

/////////////////////////////////////////
// APPOINTMENT PARTIAL SCHEMA
/////////////////////////////////////////

export const AppointmentPartialSchema = AppointmentSchema.partial()

export type AppointmentPartial = z.infer<typeof AppointmentPartialSchema>

/////////////////////////////////////////
// APPOINTMENT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const AppointmentOptionalDefaultsSchema = AppointmentSchema.merge(z.object({
  id: z.number().int().optional(),
  /**
   * Tutto il giorno: `startAt`/`endAt` sono la mezzanotte locale del primo
   * giorno e quella successiva all'ultimo, e la griglia li mette nella fascia alta.
   */
  allDay: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type AppointmentOptionalDefaults = z.infer<typeof AppointmentOptionalDefaultsSchema>

/////////////////////////////////////////
// APPOINTMENT RELATION SCHEMA
/////////////////////////////////////////

export type AppointmentRelations = {
  organization: OrganizationWithRelations;
  venue?: VenueWithRelations | null;
  createdBy: UserWithRelations;
};

export type AppointmentWithRelations = z.infer<typeof AppointmentSchema> & AppointmentRelations

export const AppointmentWithRelationsSchema: z.ZodType<AppointmentWithRelations> = AppointmentSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  venue: z.lazy(() => VenueWithRelationsSchema).nullish(),
  createdBy: z.lazy(() => UserWithRelationsSchema),
}))

/////////////////////////////////////////
// APPOINTMENT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type AppointmentOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  venue?: VenueOptionalDefaultsWithRelations | null;
  createdBy: UserOptionalDefaultsWithRelations;
};

export type AppointmentOptionalDefaultsWithRelations = z.infer<typeof AppointmentOptionalDefaultsSchema> & AppointmentOptionalDefaultsRelations

export const AppointmentOptionalDefaultsWithRelationsSchema: z.ZodType<AppointmentOptionalDefaultsWithRelations> = AppointmentOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  venue: z.lazy(() => VenueOptionalDefaultsWithRelationsSchema).nullish(),
  createdBy: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// APPOINTMENT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type AppointmentPartialRelations = {
  organization?: OrganizationPartialWithRelations;
  venue?: VenuePartialWithRelations | null;
  createdBy?: UserPartialWithRelations;
};

export type AppointmentPartialWithRelations = z.infer<typeof AppointmentPartialSchema> & AppointmentPartialRelations

export const AppointmentPartialWithRelationsSchema: z.ZodType<AppointmentPartialWithRelations> = AppointmentPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  venue: z.lazy(() => VenuePartialWithRelationsSchema).nullish(),
  createdBy: z.lazy(() => UserPartialWithRelationsSchema),
})).partial()

export type AppointmentOptionalDefaultsWithPartialRelations = z.infer<typeof AppointmentOptionalDefaultsSchema> & AppointmentPartialRelations

export const AppointmentOptionalDefaultsWithPartialRelationsSchema: z.ZodType<AppointmentOptionalDefaultsWithPartialRelations> = AppointmentOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  venue: z.lazy(() => VenuePartialWithRelationsSchema).nullish(),
  createdBy: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export type AppointmentWithPartialRelations = z.infer<typeof AppointmentSchema> & AppointmentPartialRelations

export const AppointmentWithPartialRelationsSchema: z.ZodType<AppointmentWithPartialRelations> = AppointmentSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  venue: z.lazy(() => VenuePartialWithRelationsSchema).nullish(),
  createdBy: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export default AppointmentSchema;
