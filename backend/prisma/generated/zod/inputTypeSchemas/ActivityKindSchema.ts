import { z } from 'zod';

export const ActivityKindSchema = z.enum(['CHECK_IN','REGISTRATION','PAYMENT','CALENDAR','PROSPECT']);

export type ActivityKindType = `${z.infer<typeof ActivityKindSchema>}`

export default ActivityKindSchema;
