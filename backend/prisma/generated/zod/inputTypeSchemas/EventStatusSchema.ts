import { z } from 'zod';

export const EventStatusSchema = z.enum(['DRAFT','PUBLISHED','SALES_CLOSED','RUNNING','ENDED','ARCHIVED','CANCELLED']);

export type EventStatusType = `${z.infer<typeof EventStatusSchema>}`

export default EventStatusSchema;
