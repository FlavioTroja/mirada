import { z } from 'zod';

export const PriceTierScalarFieldEnumSchema = z.enum(['id','ticketTypeId','kind','price','validUntil','maxQuantity','soldQuantity','sortOrder','createdAt','updatedAt']);

export default PriceTierScalarFieldEnumSchema;
