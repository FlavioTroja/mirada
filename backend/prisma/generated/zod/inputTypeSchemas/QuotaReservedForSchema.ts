import { z } from 'zod';

export const QuotaReservedForSchema = z.enum(['COMPLIMENTARY','EXTERNAL_CHANNEL']);

export type QuotaReservedForType = `${z.infer<typeof QuotaReservedForSchema>}`

export default QuotaReservedForSchema;
