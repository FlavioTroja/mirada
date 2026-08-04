import { z } from 'zod';

export const RequirementOutcomeStatusSchema = z.enum(['TO_PROVIDE','UNDER_REVIEW','VALID','REJECTED','EXPIRED']);

export type RequirementOutcomeStatusType = `${z.infer<typeof RequirementOutcomeStatusSchema>}`

export default RequirementOutcomeStatusSchema;
