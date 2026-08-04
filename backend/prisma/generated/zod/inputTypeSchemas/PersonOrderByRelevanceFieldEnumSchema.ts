import { z } from 'zod';

export const PersonOrderByRelevanceFieldEnumSchema = z.enum(['name','surname','fiscalCode','vatNumber','note','avatarUrl','bornIn','livesIn']);

export default PersonOrderByRelevanceFieldEnumSchema;
