import { z } from 'zod';

export const RoleNameSchema = z.enum(['GOD','ADMIN','USER','OWNER','EVENT_MANAGER','CHECKIN_OPERATOR','DANCER']);

export type RoleNameType = `${z.infer<typeof RoleNameSchema>}`

export default RoleNameSchema;
