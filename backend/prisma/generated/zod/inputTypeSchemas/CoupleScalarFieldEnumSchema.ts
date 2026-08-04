import { z } from 'zod';

export const CoupleScalarFieldEnumSchema = z.enum(['id','eventId','dissolvedAt','deleted','createdAt','updatedAt']);

export default CoupleScalarFieldEnumSchema;
