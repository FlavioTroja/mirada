import { z } from 'zod';

export const SalesChannelStatusSchema = z.enum(['ACTIVE','PAUSED','DISABLED']);

export type SalesChannelStatusType = `${z.infer<typeof SalesChannelStatusSchema>}`

export default SalesChannelStatusSchema;
