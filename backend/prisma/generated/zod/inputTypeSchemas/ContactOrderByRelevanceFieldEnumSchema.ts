import { z } from 'zod';

export const ContactOrderByRelevanceFieldEnumSchema = z.enum(['email','phoneNumber','note','telephone','pec']);

export default ContactOrderByRelevanceFieldEnumSchema;
