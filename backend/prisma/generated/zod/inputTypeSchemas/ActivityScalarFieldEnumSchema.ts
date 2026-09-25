import { z } from 'zod';

export const ActivityScalarFieldEnumSchema = z.enum(['id','organizationId','kind','severity','text','actorName','staff','amount','eventId','createdAt']);

export default ActivityScalarFieldEnumSchema;
