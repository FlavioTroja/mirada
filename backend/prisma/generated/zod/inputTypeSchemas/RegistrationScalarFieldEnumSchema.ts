import { z } from 'zod';

export const RegistrationScalarFieldEnumSchema = z.enum(['id','eventId','personId','holderName','holderSurname','holderEmail','declaredRole','assignedRole','channel','status','confirmedAt','declinedAt','coupleId','isMinor','guardianUserId','externalSaleId','balanceDueAmount','balanceSettledAmount','deleted','createdAt','updatedAt']);

export default RegistrationScalarFieldEnumSchema;
