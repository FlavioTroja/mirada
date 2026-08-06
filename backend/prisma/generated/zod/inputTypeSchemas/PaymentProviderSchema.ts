import { z } from 'zod';

export const PaymentProviderSchema = z.enum(['NONE','STRIPE']);

export type PaymentProviderType = `${z.infer<typeof PaymentProviderSchema>}`

export default PaymentProviderSchema;
