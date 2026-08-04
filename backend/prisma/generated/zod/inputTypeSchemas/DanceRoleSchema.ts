import { z } from 'zod';

export const DanceRoleSchema = z.enum(['LEADER','FOLLOWER']);

export type DanceRoleType = `${z.infer<typeof DanceRoleSchema>}`

export default DanceRoleSchema;
