import { z } from 'zod';

export const ExternalSaleStatusSchema = z.enum(['RECEIVED','INGESTED','QUARANTINED','REFUNDED','FAILED']);

export type ExternalSaleStatusType = `${z.infer<typeof ExternalSaleStatusSchema>}`

export default ExternalSaleStatusSchema;
