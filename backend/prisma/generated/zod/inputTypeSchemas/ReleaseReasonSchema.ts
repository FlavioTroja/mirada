import { z } from 'zod';

export const ReleaseReasonSchema = z.enum(['EXPIRED','ABANDONED','PAYMENT_FAILED','COMPLETED']);

export type ReleaseReasonType = `${z.infer<typeof ReleaseReasonSchema>}`

export default ReleaseReasonSchema;
