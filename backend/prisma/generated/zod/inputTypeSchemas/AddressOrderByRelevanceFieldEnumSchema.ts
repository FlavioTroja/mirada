import { z } from 'zod';

export const AddressOrderByRelevanceFieldEnumSchema = z.enum(['country','state','province','city','zipCode','address','number','note','region']);

export default AddressOrderByRelevanceFieldEnumSchema;
