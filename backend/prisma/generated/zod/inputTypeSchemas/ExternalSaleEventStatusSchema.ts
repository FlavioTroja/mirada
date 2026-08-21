import { z } from 'zod';

export const ExternalSaleEventStatusSchema = z.enum(['RECEIVED','PROCESSED','IGNORED','FAILED']);

export type ExternalSaleEventStatusType = `${z.infer<typeof ExternalSaleEventStatusSchema>}`

export default ExternalSaleEventStatusSchema;
