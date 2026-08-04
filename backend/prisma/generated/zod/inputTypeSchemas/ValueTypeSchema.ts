import { z } from 'zod';

export const ValueTypeSchema = z.enum(['float','integer','string','boolean','json']);

export type ValueTypeType = `${z.infer<typeof ValueTypeSchema>}`

export default ValueTypeSchema;
