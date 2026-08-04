import { z } from 'zod';

export const CheckInScalarFieldEnumSchema = z.enum(['id','ticketId','sessionId','registrationId','operatorUserId','kind','scannedAt','syncedAt','deviceId','offline','conflictWithId','revokedAt','deleted','createdAt','updatedAt']);

export default CheckInScalarFieldEnumSchema;
