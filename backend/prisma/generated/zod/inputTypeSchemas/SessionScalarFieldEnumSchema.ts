import { z } from 'zod';

export const SessionScalarFieldEnumSchema = z.enum(['id','eventId','name','startAt','endAt','room','level','allocationWeight','isImplicit','cancelledAt','cancellationReason','sortOrder','deleted','createdAt','updatedAt']);

export default SessionScalarFieldEnumSchema;
