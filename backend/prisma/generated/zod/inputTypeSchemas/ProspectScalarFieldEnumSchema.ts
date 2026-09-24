import { z } from 'zod';

export const ProspectScalarFieldEnumSchema = z.enum(['id','organizationId','sourceEventId','name','surname','email','phone','preferredRole','note','consentAt','status','contactedAt','convertedRegistrationId','convertedAt','createdAt','updatedAt']);

export default ProspectScalarFieldEnumSchema;
