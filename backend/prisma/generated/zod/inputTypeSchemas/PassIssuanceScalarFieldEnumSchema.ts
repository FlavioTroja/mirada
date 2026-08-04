import { z } from 'zod';

export const PassIssuanceScalarFieldEnumSchema = z.enum(['id','eventId','ticketTypeId','issuedByUserId','quantity','reason','role','nominal','note','issuedAt','revokedAt','deleted','createdAt','updatedAt']);

export default PassIssuanceScalarFieldEnumSchema;
