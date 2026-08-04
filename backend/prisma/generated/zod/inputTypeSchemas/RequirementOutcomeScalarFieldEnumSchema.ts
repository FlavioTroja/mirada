import { z } from 'zod';

export const RequirementOutcomeScalarFieldEnumSchema = z.enum(['id','registrationId','eventRequirementId','status','value','acceptedAt','acceptedIp','acceptedVersion','reviewedByUserId','reviewedAt','rejectionReason','deleted','createdAt','updatedAt']);

export default RequirementOutcomeScalarFieldEnumSchema;
