import { z } from 'zod';

export const CapacityQuotaScalarFieldEnumSchema = z.enum(['id','eventId','scope','scopeId','role','limit','consumed','limiting','reservedFor','imbalanceTolerance','overbookAllowance','publiclyVisible','deleted','createdAt','updatedAt']);

export default CapacityQuotaScalarFieldEnumSchema;
