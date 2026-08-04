import { z } from 'zod';

export const TicketStatusSchema = z.enum(['VALID','TRANSFERRED','CANCELLED','REFUNDED']);

export type TicketStatusType = `${z.infer<typeof TicketStatusSchema>}`

export default TicketStatusSchema;
