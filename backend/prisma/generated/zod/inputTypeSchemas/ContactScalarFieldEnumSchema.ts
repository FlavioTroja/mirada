import { z } from 'zod';

export const ContactScalarFieldEnumSchema = z.enum(['id','email','phoneNumber','note','telephone','pec','createdAt','updatedAt']);

export default ContactScalarFieldEnumSchema;
