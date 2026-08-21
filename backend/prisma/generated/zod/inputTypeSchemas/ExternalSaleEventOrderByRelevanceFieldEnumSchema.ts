import { z } from 'zod';

export const ExternalSaleEventOrderByRelevanceFieldEnumSchema = z.enum(['externalEventId','topic','externalOrderId','error']);

export default ExternalSaleEventOrderByRelevanceFieldEnumSchema;
