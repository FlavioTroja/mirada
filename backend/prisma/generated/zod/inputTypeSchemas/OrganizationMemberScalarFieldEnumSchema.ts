import { z } from 'zod';

export const OrganizationMemberScalarFieldEnumSchema = z.enum(['id','organizationId','userId','role','invitedAt','acceptedAt','deleted','createdAt','updatedAt']);

export default OrganizationMemberScalarFieldEnumSchema;
