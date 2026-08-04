import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { OrganizationWithRelationsSchema, OrganizationPartialWithRelationsSchema, OrganizationOptionalDefaultsWithRelationsSchema } from './OrganizationSchema'
import type { OrganizationWithRelations, OrganizationPartialWithRelations, OrganizationOptionalDefaultsWithRelations } from './OrganizationSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'

/////////////////////////////////////////
// REFUND POLICY SCHEMA
/////////////////////////////////////////

export const RefundPolicySchema = z.object({
  id: z.number().int(),
  /**
   * I18nText { it, en? }
   */
  name: JsonValueSchema,
  /**
   * [{ daysBefore, percent }]
   */
  tiers: JsonValueSchema,
  transferDeadlineHours: z.number().int(),
  feeRefundable: z.boolean(),
  isPlatformPreset: z.boolean(),
  /**
   * Null = preset di piattaforma.
   */
  organizationId: z.number().int().nullish(),
  /**
   * Preset di piattaforma da cui la policy discende (emendamento B.0 al §3.6).
   * È il termine di paragone che rende verificabile la regola del §4.4:
   * una policy derivata può essere più favorevole al partecipante, mai più restrittiva.
   */
  derivedFromPolicyId: z.number().int().nullish(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type RefundPolicy = z.infer<typeof RefundPolicySchema>

/////////////////////////////////////////
// REFUND POLICY PARTIAL SCHEMA
/////////////////////////////////////////

export const RefundPolicyPartialSchema = RefundPolicySchema.partial()

export type RefundPolicyPartial = z.infer<typeof RefundPolicyPartialSchema>

/////////////////////////////////////////
// REFUND POLICY OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const RefundPolicyOptionalDefaultsSchema = RefundPolicySchema.merge(z.object({
  id: z.number().int().optional(),
  /**
   * [{ daysBefore, percent }]
   */
  tiers: JsonValueSchema,
  transferDeadlineHours: z.number().int().optional(),
  feeRefundable: z.boolean().optional(),
  isPlatformPreset: z.boolean().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type RefundPolicyOptionalDefaults = z.infer<typeof RefundPolicyOptionalDefaultsSchema>

/////////////////////////////////////////
// REFUND POLICY RELATION SCHEMA
/////////////////////////////////////////

export type RefundPolicyRelations = {
  organization?: OrganizationWithRelations | null;
  derivedFromPolicy?: RefundPolicyWithRelations | null;
  derivedPolicies: RefundPolicyWithRelations[];
  events: EventWithRelations[];
};

export type RefundPolicyWithRelations = z.infer<typeof RefundPolicySchema> & RefundPolicyRelations

export const RefundPolicyWithRelationsSchema: z.ZodType<RefundPolicyWithRelations> = RefundPolicySchema.merge(z.object({
  organization: z.lazy(() => OrganizationWithRelationsSchema).nullish(),
  derivedFromPolicy: z.lazy(() => RefundPolicyWithRelationsSchema).nullish(),
  derivedPolicies: z.lazy(() => RefundPolicyWithRelationsSchema).array(),
  events: z.lazy(() => EventWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// REFUND POLICY OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type RefundPolicyOptionalDefaultsRelations = {
  organization?: OrganizationOptionalDefaultsWithRelations | null;
  derivedFromPolicy?: RefundPolicyOptionalDefaultsWithRelations | null;
  derivedPolicies: RefundPolicyOptionalDefaultsWithRelations[];
  events: EventOptionalDefaultsWithRelations[];
};

export type RefundPolicyOptionalDefaultsWithRelations = z.infer<typeof RefundPolicyOptionalDefaultsSchema> & RefundPolicyOptionalDefaultsRelations

export const RefundPolicyOptionalDefaultsWithRelationsSchema: z.ZodType<RefundPolicyOptionalDefaultsWithRelations> = RefundPolicyOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationOptionalDefaultsWithRelationsSchema).nullish(),
  derivedFromPolicy: z.lazy(() => RefundPolicyOptionalDefaultsWithRelationsSchema).nullish(),
  derivedPolicies: z.lazy(() => RefundPolicyOptionalDefaultsWithRelationsSchema).array(),
  events: z.lazy(() => EventOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// REFUND POLICY PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type RefundPolicyPartialRelations = {
  organization?: OrganizationPartialWithRelations | null;
  derivedFromPolicy?: RefundPolicyPartialWithRelations | null;
  derivedPolicies?: RefundPolicyPartialWithRelations[];
  events?: EventPartialWithRelations[];
};

export type RefundPolicyPartialWithRelations = z.infer<typeof RefundPolicyPartialSchema> & RefundPolicyPartialRelations

export const RefundPolicyPartialWithRelationsSchema: z.ZodType<RefundPolicyPartialWithRelations> = RefundPolicyPartialSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema).nullish(),
  derivedFromPolicy: z.lazy(() => RefundPolicyPartialWithRelationsSchema).nullish(),
  derivedPolicies: z.lazy(() => RefundPolicyPartialWithRelationsSchema).array(),
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
})).partial()

export type RefundPolicyOptionalDefaultsWithPartialRelations = z.infer<typeof RefundPolicyOptionalDefaultsSchema> & RefundPolicyPartialRelations

export const RefundPolicyOptionalDefaultsWithPartialRelationsSchema: z.ZodType<RefundPolicyOptionalDefaultsWithPartialRelations> = RefundPolicyOptionalDefaultsSchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema).nullish(),
  derivedFromPolicy: z.lazy(() => RefundPolicyPartialWithRelationsSchema).nullish(),
  derivedPolicies: z.lazy(() => RefundPolicyPartialWithRelationsSchema).array(),
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
}).partial())

export type RefundPolicyWithPartialRelations = z.infer<typeof RefundPolicySchema> & RefundPolicyPartialRelations

export const RefundPolicyWithPartialRelationsSchema: z.ZodType<RefundPolicyWithPartialRelations> = RefundPolicySchema.merge(z.object({
  organization: z.lazy(() => OrganizationPartialWithRelationsSchema).nullish(),
  derivedFromPolicy: z.lazy(() => RefundPolicyPartialWithRelationsSchema).nullish(),
  derivedPolicies: z.lazy(() => RefundPolicyPartialWithRelationsSchema).array(),
  events: z.lazy(() => EventPartialWithRelationsSchema).array(),
}).partial())

export default RefundPolicySchema;
