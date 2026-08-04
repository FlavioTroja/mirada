import { z } from 'zod';

export const ReservationScalarFieldEnumSchema = z.enum(['id','orderId','eventId','userId','expiresAt','rearmedAt','releasedAt','releaseReason','deleted','createdAt','updatedAt']);

export default ReservationScalarFieldEnumSchema;
