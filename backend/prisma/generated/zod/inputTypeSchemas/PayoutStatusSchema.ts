import { z } from 'zod';

export const PayoutStatusSchema = z.enum(['NOT_CONNECTED','PENDING','ENABLED','DISABLED']);

export type PayoutStatusType = `${z.infer<typeof PayoutStatusSchema>}`

export default PayoutStatusSchema;
