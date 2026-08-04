import { z } from 'zod';

export const DeclaredDanceRoleSchema = z.enum(['LEADER','FOLLOWER','FLEXIBLE']);

export type DeclaredDanceRoleType = `${z.infer<typeof DeclaredDanceRoleSchema>}`

export default DeclaredDanceRoleSchema;
