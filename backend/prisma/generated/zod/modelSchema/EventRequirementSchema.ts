import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { RequirementBlockingSchema } from '../inputTypeSchemas/RequirementBlockingSchema'
import { RequirementVerificationSchema } from '../inputTypeSchemas/RequirementVerificationSchema'
import { EventWithRelationsSchema, EventPartialWithRelationsSchema, EventOptionalDefaultsWithRelationsSchema } from './EventSchema'
import type { EventWithRelations, EventPartialWithRelations, EventOptionalDefaultsWithRelations } from './EventSchema'
import { RequirementTypeWithRelationsSchema, RequirementTypePartialWithRelationsSchema, RequirementTypeOptionalDefaultsWithRelationsSchema } from './RequirementTypeSchema'
import type { RequirementTypeWithRelations, RequirementTypePartialWithRelations, RequirementTypeOptionalDefaultsWithRelations } from './RequirementTypeSchema'
import { RequirementOutcomeWithRelationsSchema, RequirementOutcomePartialWithRelationsSchema, RequirementOutcomeOptionalDefaultsWithRelationsSchema } from './RequirementOutcomeSchema'
import type { RequirementOutcomeWithRelations, RequirementOutcomePartialWithRelations, RequirementOutcomeOptionalDefaultsWithRelations } from './RequirementOutcomeSchema'

/////////////////////////////////////////
// EVENT REQUIREMENT SCHEMA
/////////////////////////////////////////

export const EventRequirementSchema = z.object({
  blocking: RequirementBlockingSchema,
  verification: RequirementVerificationSchema,
  id: z.number().int(),
  eventId: z.number().int(),
  requirementTypeId: z.number().int(),
  /**
   * I18nText { it, en? }
   */
  label: JsonValueSchema,
  /**
   * I18nText { it, en? }
   */
  text: JsonValueSchema,
  mandatory: z.boolean(),
  dueAt: z.coerce.date().nullish(),
  config: JsonValueSchema,
  sortOrder: z.number().int(),
  deleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type EventRequirement = z.infer<typeof EventRequirementSchema>

/////////////////////////////////////////
// EVENT REQUIREMENT PARTIAL SCHEMA
/////////////////////////////////////////

export const EventRequirementPartialSchema = EventRequirementSchema.partial()

export type EventRequirementPartial = z.infer<typeof EventRequirementPartialSchema>

/////////////////////////////////////////
// EVENT REQUIREMENT OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const EventRequirementOptionalDefaultsSchema = EventRequirementSchema.merge(z.object({
  blocking: RequirementBlockingSchema.optional(),
  verification: RequirementVerificationSchema.optional(),
  id: z.number().int().optional(),
  mandatory: z.boolean().optional(),
  config: JsonValueSchema,
  sortOrder: z.number().int().optional(),
  deleted: z.boolean().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type EventRequirementOptionalDefaults = z.infer<typeof EventRequirementOptionalDefaultsSchema>

/////////////////////////////////////////
// EVENT REQUIREMENT RELATION SCHEMA
/////////////////////////////////////////

export type EventRequirementRelations = {
  event: EventWithRelations;
  requirementType: RequirementTypeWithRelations;
  outcomes: RequirementOutcomeWithRelations[];
};

export type EventRequirementWithRelations = z.infer<typeof EventRequirementSchema> & EventRequirementRelations

export const EventRequirementWithRelationsSchema: z.ZodType<EventRequirementWithRelations> = EventRequirementSchema.merge(z.object({
  event: z.lazy(() => EventWithRelationsSchema),
  requirementType: z.lazy(() => RequirementTypeWithRelationsSchema),
  outcomes: z.lazy(() => RequirementOutcomeWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// EVENT REQUIREMENT OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type EventRequirementOptionalDefaultsRelations = {
  event: EventOptionalDefaultsWithRelations;
  requirementType: RequirementTypeOptionalDefaultsWithRelations;
  outcomes: RequirementOutcomeOptionalDefaultsWithRelations[];
};

export type EventRequirementOptionalDefaultsWithRelations = z.infer<typeof EventRequirementOptionalDefaultsSchema> & EventRequirementOptionalDefaultsRelations

export const EventRequirementOptionalDefaultsWithRelationsSchema: z.ZodType<EventRequirementOptionalDefaultsWithRelations> = EventRequirementOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventOptionalDefaultsWithRelationsSchema),
  requirementType: z.lazy(() => RequirementTypeOptionalDefaultsWithRelationsSchema),
  outcomes: z.lazy(() => RequirementOutcomeOptionalDefaultsWithRelationsSchema).array(),
}))

/////////////////////////////////////////
// EVENT REQUIREMENT PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type EventRequirementPartialRelations = {
  event?: EventPartialWithRelations;
  requirementType?: RequirementTypePartialWithRelations;
  outcomes?: RequirementOutcomePartialWithRelations[];
};

export type EventRequirementPartialWithRelations = z.infer<typeof EventRequirementPartialSchema> & EventRequirementPartialRelations

export const EventRequirementPartialWithRelationsSchema: z.ZodType<EventRequirementPartialWithRelations> = EventRequirementPartialSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  requirementType: z.lazy(() => RequirementTypePartialWithRelationsSchema),
  outcomes: z.lazy(() => RequirementOutcomePartialWithRelationsSchema).array(),
})).partial()

export type EventRequirementOptionalDefaultsWithPartialRelations = z.infer<typeof EventRequirementOptionalDefaultsSchema> & EventRequirementPartialRelations

export const EventRequirementOptionalDefaultsWithPartialRelationsSchema: z.ZodType<EventRequirementOptionalDefaultsWithPartialRelations> = EventRequirementOptionalDefaultsSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  requirementType: z.lazy(() => RequirementTypePartialWithRelationsSchema),
  outcomes: z.lazy(() => RequirementOutcomePartialWithRelationsSchema).array(),
}).partial())

export type EventRequirementWithPartialRelations = z.infer<typeof EventRequirementSchema> & EventRequirementPartialRelations

export const EventRequirementWithPartialRelationsSchema: z.ZodType<EventRequirementWithPartialRelations> = EventRequirementSchema.merge(z.object({
  event: z.lazy(() => EventPartialWithRelationsSchema),
  requirementType: z.lazy(() => RequirementTypePartialWithRelationsSchema),
  outcomes: z.lazy(() => RequirementOutcomePartialWithRelationsSchema).array(),
}).partial())

export default EventRequirementSchema;
