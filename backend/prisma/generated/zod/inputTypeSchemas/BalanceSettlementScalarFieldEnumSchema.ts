import { z } from 'zod';

export const BalanceSettlementScalarFieldEnumSchema = z.enum(['id','registrationId','amount','method','operatorUserId','collectedAt','syncedAt','deviceId','offline','deviceReference','conflictWithId','note','deleted','createdAt','updatedAt']);

export default BalanceSettlementScalarFieldEnumSchema;
