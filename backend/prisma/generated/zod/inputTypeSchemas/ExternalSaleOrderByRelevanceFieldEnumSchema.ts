import { z } from 'zod';

export const ExternalSaleOrderByRelevanceFieldEnumSchema = z.enum(['externalOrderId','externalOrderNumber','buyerName','buyerSurname','buyerEmail','currency','quarantineReason']);

export default ExternalSaleOrderByRelevanceFieldEnumSchema;
