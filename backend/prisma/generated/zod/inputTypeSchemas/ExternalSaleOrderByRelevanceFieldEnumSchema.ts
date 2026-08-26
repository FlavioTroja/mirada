import { z } from 'zod';

export const ExternalSaleOrderByRelevanceFieldEnumSchema = z.enum(['externalOrderId','externalOrderNumber','buyerName','buyerSurname','buyerEmail','externalCustomerId','customerLocale','currency','quarantineReason']);

export default ExternalSaleOrderByRelevanceFieldEnumSchema;
