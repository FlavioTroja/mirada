import { z } from 'zod';

export const EventTypeScalarFieldEnumSchema = z.enum(['id','name','slug','capMultiSession','capRoleQuotas','capLevels','capCast','capCouple','defaultTemplate','active','sortOrder','deleted','createdAt','updatedAt']);

export default EventTypeScalarFieldEnumSchema;
