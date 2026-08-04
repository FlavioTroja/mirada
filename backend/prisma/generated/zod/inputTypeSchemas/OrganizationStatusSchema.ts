import { z } from 'zod';

export const OrganizationStatusSchema = z.enum(['PENDING','APPROVED','SUSPENDED','REJECTED']);

export type OrganizationStatusType = `${z.infer<typeof OrganizationStatusSchema>}`

export default OrganizationStatusSchema;
