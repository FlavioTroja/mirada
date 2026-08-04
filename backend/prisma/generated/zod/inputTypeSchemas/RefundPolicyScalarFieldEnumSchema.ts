import { z } from 'zod';

export const RefundPolicyScalarFieldEnumSchema = z.enum(['id','name','tiers','transferDeadlineHours','feeRefundable','isPlatformPreset','organizationId','derivedFromPolicyId','deleted','createdAt','updatedAt']);

export default RefundPolicyScalarFieldEnumSchema;
