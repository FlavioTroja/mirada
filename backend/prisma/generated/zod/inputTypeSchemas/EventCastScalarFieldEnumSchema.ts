import { z } from 'zod';

export const EventCastScalarFieldEnumSchema = z.enum(['id','eventId','artistId','kind','sortOrder','deleted','createdAt','updatedAt']);

export default EventCastScalarFieldEnumSchema;
