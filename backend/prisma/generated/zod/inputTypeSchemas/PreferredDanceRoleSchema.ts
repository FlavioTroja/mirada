import { z } from 'zod';

export const PreferredDanceRoleSchema = z.enum(['LEADER','FOLLOWER','BOTH']);

export type PreferredDanceRoleType = `${z.infer<typeof PreferredDanceRoleSchema>}`

export default PreferredDanceRoleSchema;
