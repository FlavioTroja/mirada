import { z } from 'zod';

export const TicketTypeScalarFieldEnumSchema = z.enum(['id','eventId','name','description','basePrice','saleUnit','roleConstraint','consumesRoleQuota','saleOpensAt','saleClosesAt','visibility','accessCode','minPerOrder','maxPerOrder','indicatedLevel','highlighted','sortOrder','deleted','createdAt','updatedAt']);

export default TicketTypeScalarFieldEnumSchema;
