import { z } from 'zod';

export const OrganizationInvitationScalarFieldEnumSchema = z.enum(['id','organizationId','email','role','tokenHash','invitedById','expiresAt','acceptedAt','acceptedById','revokedAt','createdAt','updatedAt']);

export default OrganizationInvitationScalarFieldEnumSchema;
