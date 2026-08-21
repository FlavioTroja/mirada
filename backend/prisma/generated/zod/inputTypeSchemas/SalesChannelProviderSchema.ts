import { z } from 'zod';

export const SalesChannelProviderSchema = z.enum(['SHOPIFY']);

export type SalesChannelProviderType = `${z.infer<typeof SalesChannelProviderSchema>}`

export default SalesChannelProviderSchema;
