import { z } from 'zod';

export const TicketTransferScalarFieldEnumSchema = z.enum(['id','ticketId','fromUserId','toUserId','fromHolder','toHolder','previousCode','transferredAt','deleted','createdAt','updatedAt']);

export default TicketTransferScalarFieldEnumSchema;
