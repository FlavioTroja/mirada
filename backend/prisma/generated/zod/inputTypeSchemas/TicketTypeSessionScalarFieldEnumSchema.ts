import { z } from 'zod';

export const TicketTypeSessionScalarFieldEnumSchema = z.enum(['id','ticketTypeId','sessionId','createdAt','updatedAt']);

export default TicketTypeSessionScalarFieldEnumSchema;
