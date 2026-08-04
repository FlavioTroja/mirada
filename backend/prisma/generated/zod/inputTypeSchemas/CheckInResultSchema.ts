import { z } from 'zod';

export const CheckInResultSchema = z.enum(['VALID','ALREADY_USED','WRONG_EVENT','REFUNDED_OR_CANCELLED','REQUIREMENT_BLOCKED']);

export type CheckInResultType = `${z.infer<typeof CheckInResultSchema>}`

export default CheckInResultSchema;
