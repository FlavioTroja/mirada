import { z } from 'zod';

export const RequirementBlockingSchema = z.enum(['PURCHASE','ENTRY','NONE']);

export type RequirementBlockingType = `${z.infer<typeof RequirementBlockingSchema>}`

export default RequirementBlockingSchema;
