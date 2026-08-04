import { z } from 'zod';

export const AddressOrderByRelevanceFieldEnumSchema = z.enum(['country','state','province','city','zipCode','address','number','note']);

export default AddressOrderByRelevanceFieldEnumSchema;
