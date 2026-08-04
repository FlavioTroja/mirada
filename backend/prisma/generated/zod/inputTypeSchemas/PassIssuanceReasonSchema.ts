import { z } from 'zod';

export const PassIssuanceReasonSchema = z.enum(['COMPLIMENTARY','EXTERNAL_SALE','GIFT','COURTESY']);

export type PassIssuanceReasonType = `${z.infer<typeof PassIssuanceReasonSchema>}`

export default PassIssuanceReasonSchema;
