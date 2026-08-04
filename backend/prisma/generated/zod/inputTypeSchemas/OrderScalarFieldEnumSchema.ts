import { z } from 'zod';

export const OrderScalarFieldEnumSchema = z.enum(['id','purchaseId','organizationId','eventId','status','subtotal','presaleRights','total','priceLockedAt','expiresAt','paidAt','failedAt','cancelledAt','deleted','createdAt','updatedAt']);

export default OrderScalarFieldEnumSchema;
