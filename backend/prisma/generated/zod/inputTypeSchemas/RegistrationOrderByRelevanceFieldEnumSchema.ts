import { z } from 'zod';

export const RegistrationOrderByRelevanceFieldEnumSchema = z.enum(['holderName','holderSurname','holderEmail']);

export default RegistrationOrderByRelevanceFieldEnumSchema;
