import { z } from 'zod';

export const PaymentOrderByRelevanceFieldEnumSchema = z.enum(['providerPaymentId','providerAccountId','idempotencyKey','processedEventIds']);

export default PaymentOrderByRelevanceFieldEnumSchema;
