import { z } from 'zod';

export const SalesCloseCriterionSchema = z.enum(['DATE','QUOTA_EXHAUSTED','MANUAL','EVENT_START']);

export type SalesCloseCriterionType = `${z.infer<typeof SalesCloseCriterionSchema>}`

export default SalesCloseCriterionSchema;
