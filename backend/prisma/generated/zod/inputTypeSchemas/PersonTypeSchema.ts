import { z } from 'zod';

export const PersonTypeSchema = z.enum(['USER']);

export type PersonTypeType = `${z.infer<typeof PersonTypeSchema>}`

export default PersonTypeSchema;
