import { z } from 'zod';

export const RequirementVerificationSchema = z.enum(['AUTOMATIC','MANUAL']);

export type RequirementVerificationType = `${z.infer<typeof RequirementVerificationSchema>}`

export default RequirementVerificationSchema;
