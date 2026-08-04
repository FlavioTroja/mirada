import { z } from 'zod';

export const RoleScalarFieldEnumSchema = z.enum(['name','label','rank','isActive','createdAt','updatedAt']);

export default RoleScalarFieldEnumSchema;
