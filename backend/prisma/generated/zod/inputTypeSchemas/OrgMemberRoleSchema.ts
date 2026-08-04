import { z } from 'zod';

export const OrgMemberRoleSchema = z.enum(['OWNER','EVENT_MANAGER','CHECKIN_OPERATOR']);

export type OrgMemberRoleType = `${z.infer<typeof OrgMemberRoleSchema>}`

export default OrgMemberRoleSchema;
