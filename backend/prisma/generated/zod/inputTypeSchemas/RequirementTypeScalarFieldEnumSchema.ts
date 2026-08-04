import { z } from 'zod';

export const RequirementTypeScalarFieldEnumSchema = z.enum(['id','name','kind','configSchema','active','deleted','createdAt','updatedAt']);

export default RequirementTypeScalarFieldEnumSchema;
