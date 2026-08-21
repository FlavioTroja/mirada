import { z } from 'zod';

export const RegistrationScalarFieldEnumSchema = z.enum(['id','eventId','personUserId','holderName','holderSurname','holderEmail','declaredRole','assignedRole','channel','status','confirmedAt','declinedAt','coupleId','isMinor','guardianUserId','externalSaleId','deleted','createdAt','updatedAt']);

export default RegistrationScalarFieldEnumSchema;
