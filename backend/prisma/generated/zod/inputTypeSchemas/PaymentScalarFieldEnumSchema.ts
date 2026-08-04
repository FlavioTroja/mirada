import { z } from 'zod';

export const PaymentScalarFieldEnumSchema = z.enum(['id','orderId','provider','providerPaymentId','providerAccountId','status','amount','applicationFeeAmount','idempotencyKey','processedEventIds','deleted','createdAt','updatedAt']);

export default PaymentScalarFieldEnumSchema;
