import { z } from 'zod';

export const RegistrationChannelSchema = z.enum(['ONLINE_SALE','DOOR_SALE','COMPLIMENTARY','EXTERNAL_CHANNEL']);

export type RegistrationChannelType = `${z.infer<typeof RegistrationChannelSchema>}`

export default RegistrationChannelSchema;
