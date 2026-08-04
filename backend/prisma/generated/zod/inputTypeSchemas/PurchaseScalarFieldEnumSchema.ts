import { z } from 'zod';

export const PurchaseScalarFieldEnumSchema = z.enum(['id','buyerUserId','totalAmount','totalPresaleRights','deleted','createdAt','updatedAt']);

export default PurchaseScalarFieldEnumSchema;
