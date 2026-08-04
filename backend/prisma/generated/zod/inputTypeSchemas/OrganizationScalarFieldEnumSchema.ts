import { z } from 'zod';

export const OrganizationScalarFieldEnumSchema = z.enum(['id','name','legalName','legalForm','vatNumber','taxCode','addressId','contactEmail','contactPhone','website','status','stripeAccountId','payoutStatus','payoutCheckedAt','termsVersion','termsAcceptedAt','logoFileId','deleted','createdAt','updatedAt']);

export default OrganizationScalarFieldEnumSchema;
