import { z } from 'zod';
import { FiscalDeclarationKindSchema } from '../inputTypeSchemas/FiscalDeclarationKindSchema'
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { UserWithRelationsSchema, UserPartialWithRelationsSchema, UserOptionalDefaultsWithRelationsSchema } from './UserSchema'
import type { UserWithRelations, UserPartialWithRelations, UserOptionalDefaultsWithRelations } from './UserSchema'

/////////////////////////////////////////
// FISCAL DECLARATION SCHEMA
/////////////////////////////////////////

/**
 * Nessun `PATCH`, nessun `DELETE`: si crea una nuova versione (`RF-ORG-8`).
 * Tutte le relazioni sono `Restrict`: una dichiarazione non si perde mai per cascata.
 */
export const FiscalDeclarationSchema = z.object({
  kind: FiscalDeclarationKindSchema,
  id: z.number().int(),
  organizationId: z.number().int(),
  eventId: z.number().int().nullish(),
  /**
   * Progressivo per (organizationId, kind, eventId) — calcolato dal servizio.
   */
  version: z.number().int(),
  frameworkLabel: z.string(),
  statementText: z.string(),
  /**
   * Calcolati dal server, mai accettati dal client (§4.3).
   */
  declaredAt: z.coerce.date(),
  declaredByUserId: z.number().int(),
  ipAddress: z.string(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type FiscalDeclaration = z.infer<typeof FiscalDeclarationSchema>

/////////////////////////////////////////
// FISCAL DECLARATION PARTIAL SCHEMA
/////////////////////////////////////////

export const FiscalDeclarationPartialSchema = FiscalDeclarationSchema.partial()

export type FiscalDeclarationPartial = z.infer<typeof FiscalDeclarationPartialSchema>

/////////////////////////////////////////
// FISCAL DECLARATION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const FiscalDeclarationOptionalDefaultsSchema = FiscalDeclarationSchema.merge(z.object({
  id: z.number().int().optional(),
  /**
   * Progressivo per (organizationId, kind, eventId) — calcolato dal servizio.
   */
  version: z.number().int().optional(),
  /**
   * Calcolati dal server, mai accettati dal client (§4.3).
   */
  declaredAt: z.coerce.date().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type FiscalDeclarationOptionalDefaults = z.infer<typeof FiscalDeclarationOptionalDefaultsSchema>

/////////////////////////////////////////
// FISCAL DECLARATION RELATION SCHEMA
/////////////////////////////////////////

export type FiscalDeclarationRelations = {
  organization: OrganizationWithRelations;
  event?: EventWithRelations | null;
  declaredBy: UserWithRelations;
};

export type FiscalDeclarationWithRelations = z.infer<typeof FiscalDeclarationSchema> & FiscalDeclarationRelations

export const FiscalDeclarationWithRelationsSchema: z.ZodType<FiscalDeclarationWithRelations> = FiscalDeclarationSchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema),
  event: z.lazy(() => EventWithRelationsSchema).nullish(),
  declaredBy: z.lazy(() => UserWithRelationsSchema),
}))

/////////////////////////////////////////
// FISCAL DECLARATION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type FiscalDeclarationOptionalDefaultsRelations = {
  organization: OrganizationOptionalDefaultsWithRelations;
  event?: EventOptionalDefaultsWithRelations | null;
  declaredBy: UserOptionalDefaultsWithRelations;
};

export type FiscalDeclarationOptionalDefaultsWithRelations = z.infer<typeof FiscalDeclarationOptionalDefaultsSchema> & FiscalDeclarationOptionalDefaultsRelations

export const FiscalDeclarationOptionalDefaultsWithRelationsSchema: z.ZodType<FiscalDeclarationOptionalDefaultsWithRelations> = FiscalDeclarationOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema),
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema).nullish(),
  declaredBy: z.lazy(() => UserOptionalDefaultsWithRelationsSchema),
}))

/////////////////////////////////////////
// FISCAL DECLARATION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type FiscalDeclarationPartialRelations = {
  organization?: OrganizationPartialWithRelations;
  event?: EventPartialWithRelations | null;
  declaredBy?: UserPartialWithRelations;
};

export type FiscalDeclarationPartialWithRelations = z.infer<typeof FiscalDeclarationPartialSchema> & FiscalDeclarationPartialRelations

export const FiscalDeclarationPartialWithRelationsSchema: z.ZodType<FiscalDeclarationPartialWithRelations> = FiscalDeclarationPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema).nullish(),
  declaredBy: z.lazy(() => UserPartialWithRelationsSchema),
})).partial()

export type FiscalDeclarationOptionalDefaultsWithPartialRelations = z.infer<typeof FiscalDeclarationOptionalDefaultsSchema> & FiscalDeclarationPartialRelations

export const FiscalDeclarationOptionalDefaultsWithPartialRelationsSchema: z.ZodType<FiscalDeclarationOptionalDefaultsWithPartialRelations> = FiscalDeclarationOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema).nullish(),
  declaredBy: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export type FiscalDeclarationWithPartialRelations = z.infer<typeof FiscalDeclarationSchema> & FiscalDeclarationPartialRelations

export const FiscalDeclarationWithPartialRelationsSchema: z.ZodType<FiscalDeclarationWithPartialRelations> = FiscalDeclarationSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema),
  event: z.lazy(() => EventPartialWithRelationsSchema).nullish(),
  declaredBy: z.lazy(() => UserPartialWithRelationsSchema),
}).partial())

export default FiscalDeclarationSchema;
