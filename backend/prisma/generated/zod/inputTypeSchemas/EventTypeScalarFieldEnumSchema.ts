import { z } from 'zod';

export const EventTypeScalarFieldEnumSchema = z.enum(['id','name','slug','family','sessionsLabel','capMultiSession','capRoleQuotas','capLevels','capCast','capCouple','defaultTemplate','active','sortOrder','deleted','createdAt','updatedAt']);

export default EventTypeScalarFieldEnumSchema;
