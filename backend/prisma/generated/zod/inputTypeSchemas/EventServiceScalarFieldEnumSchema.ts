import { z } from 'zod';

export const EventServiceScalarFieldEnumSchema = z.enum(['id','eventId','serviceTypeId','name','description','price','refundCutoffAt','attributesConfig','sortOrder','deleted','createdAt','updatedAt']);

export default EventServiceScalarFieldEnumSchema;
