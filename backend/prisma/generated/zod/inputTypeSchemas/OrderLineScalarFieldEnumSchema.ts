import { z } from 'zod';

export const OrderLineScalarFieldEnumSchema = z.enum(['id','orderId','ticketTypeId','eventServiceId','quantity','unitPrice','presaleRightsPerUnit','lineTotal','priceTierId','attendees','createdAt','updatedAt']);

export default OrderLineScalarFieldEnumSchema;
