import { z } from 'zod';

export const CheckInKindSchema = z.enum(['OPERATOR','MANUAL_SEARCH','EXTERNAL_ENTRY']);

export type CheckInKindType = `${z.infer<typeof CheckInKindSchema>}`

export default CheckInKindSchema;
