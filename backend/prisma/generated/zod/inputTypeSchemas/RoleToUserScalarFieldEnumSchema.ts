import { z } from 'zod';

export const RoleToUserScalarFieldEnumSchema = z.enum(['id','roleName','userId','isActive','createdAt','updatedAt']);

export default RoleToUserScalarFieldEnumSchema;
