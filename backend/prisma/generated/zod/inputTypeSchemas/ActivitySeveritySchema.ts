import { z } from 'zod';

export const ActivitySeveritySchema = z.enum(['INFO','WARNING','CRITICAL']);

export type ActivitySeverityType = `${z.infer<typeof ActivitySeveritySchema>}`

export default ActivitySeveritySchema;
