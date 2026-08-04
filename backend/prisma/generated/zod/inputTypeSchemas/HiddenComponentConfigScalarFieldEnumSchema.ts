import { z } from 'zod';

export const HiddenComponentConfigScalarFieldEnumSchema = z.enum(['id','roleName','context','section','component','isActive','createdAt','updatedAt']);

export default HiddenComponentConfigScalarFieldEnumSchema;
