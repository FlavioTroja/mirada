import { z } from 'zod';

export const PaymentStatusSchema = z.enum(['PENDING','SUCCEEDED','FAILED','REFUNDED','PARTIALLY_REFUNDED']);

export type PaymentStatusType = `${z.infer<typeof PaymentStatusSchema>}`

export default PaymentStatusSchema;
