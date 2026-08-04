import { z } from 'zod';

export const PermissionConfigScalarFieldEnumSchema = z.enum(['id','roleName','action','entity','scope']);

export default PermissionConfigScalarFieldEnumSchema;
