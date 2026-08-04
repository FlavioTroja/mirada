import { z } from 'zod';

export const GenderSchema = z.enum(['M','F','OTHER']);

export type GenderType = `${z.infer<typeof GenderSchema>}`

export default GenderSchema;
