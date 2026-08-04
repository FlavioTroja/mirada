import { z } from 'zod';

export const TicketScalarFieldEnumSchema = z.enum(['id','orderLineId','passIssuanceId','eventId','ticketTypeId','registrationId','code','status','holderName','holderSurname','holderEmail','bearer','qrIssuedAt','qrRevokedAt','pdfFileId','deleted','createdAt','updatedAt']);

export default TicketScalarFieldEnumSchema;
