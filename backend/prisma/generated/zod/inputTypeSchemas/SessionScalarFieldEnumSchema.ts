import { z } from 'zod';

export const SessionScalarFieldEnumSchema = z.enum(['id','eventId','name','startAt','endAt','room','level','allocationWeight','isImplicit','cancelledAt','cancellationReason','sortOrder','kind','seriesId','deleted','createdAt','updatedAt']);

export default SessionScalarFieldEnumSchema;
