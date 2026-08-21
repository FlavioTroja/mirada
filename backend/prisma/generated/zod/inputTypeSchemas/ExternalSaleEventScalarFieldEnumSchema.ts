import { z } from 'zod';

export const ExternalSaleEventScalarFieldEnumSchema = z.enum(['id','salesChannelId','externalEventId','topic','externalOrderId','payload','status','error','receivedAt','processedAt','createdAt','updatedAt']);

export default ExternalSaleEventScalarFieldEnumSchema;
