import { z } from 'zod';

export const ProspectOrderByRelevanceFieldEnumSchema = z.enum(['name','surname','email','phone','note']);

export default ProspectOrderByRelevanceFieldEnumSchema;
