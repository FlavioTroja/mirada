import { z } from 'zod';

export const ExternalSaleScalarFieldEnumSchema = z.enum(['id','salesChannelId','eventId','externalOrderId','externalOrderNumber','status','buyerName','buyerSurname','buyerEmail','totalAmount','currency','canonicalPayload','quarantineReason','receivedAt','ingestedAt','refundedAt','deleted','createdAt','updatedAt']);

export default ExternalSaleScalarFieldEnumSchema;
