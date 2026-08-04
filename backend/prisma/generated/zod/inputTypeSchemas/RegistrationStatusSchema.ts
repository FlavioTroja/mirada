import { z } from 'zod';

export const RegistrationStatusSchema = z.enum(['CONFIRMED','TO_CONFIRM','DECLINED']);

export type RegistrationStatusType = `${z.infer<typeof RegistrationStatusSchema>}`

export default RegistrationStatusSchema;
