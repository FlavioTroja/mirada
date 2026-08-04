import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { UiScopeSchema } from '../inputTypeSchemas/UiScopeSchema'
import { ValueTypeSchema } from '../inputTypeSchemas/ValueTypeSchema'

/////////////////////////////////////////
// CONFIG SCHEMA
/////////////////////////////////////////

export const ConfigSchema = z.object({
  uiScope: UiScopeSchema,
  type: ValueTypeSchema,
  name: z.string(),
  scope: z.string(),
  boolean: z.boolean().nullish(),
  integer: z.number().int().nullish(),
  float: z.number().nullish(),
  string: z.string().nullish(),
  json: JsonValueSchema.nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Config = z.infer<typeof ConfigSchema>

/////////////////////////////////////////
// CONFIG PARTIAL SCHEMA
/////////////////////////////////////////

export const ConfigPartialSchema = ConfigSchema.partial()

export type ConfigPartial = z.infer<typeof ConfigPartialSchema>

/////////////////////////////////////////
// CONFIG OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const ConfigOptionalDefaultsSchema = ConfigSchema.merge(z.object({
  uiScope: UiScopeSchema.optional(),
  type: ValueTypeSchema.optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
}))

export type ConfigOptionalDefaults = z.infer<typeof ConfigOptionalDefaultsSchema>

export default ConfigSchema;
