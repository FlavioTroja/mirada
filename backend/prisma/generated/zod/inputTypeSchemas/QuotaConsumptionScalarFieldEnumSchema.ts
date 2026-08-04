import { z } from 'zod';

export const QuotaConsumptionScalarFieldEnumSchema = z.enum(['id','capacityQuotaId','registrationId','quantity','createdAt','updatedAt']);

export default QuotaConsumptionScalarFieldEnumSchema;
