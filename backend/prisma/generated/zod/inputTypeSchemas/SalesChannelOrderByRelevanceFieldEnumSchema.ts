import { z } from 'zod';

export const SalesChannelOrderByRelevanceFieldEnumSchema = z.enum(['label','publicId','externalShopId','credentials','webhookSecret','roleAttributeName','attendeeNameAttributeName']);

export default SalesChannelOrderByRelevanceFieldEnumSchema;
