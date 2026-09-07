import { z } from 'zod';

export const PaymentInstalmentScalarFieldEnumSchema = z.enum(['id','registrationId','amount','dueAt','sortOrder','note','deleted','createdAt','updatedAt']);

export default PaymentInstalmentScalarFieldEnumSchema;
