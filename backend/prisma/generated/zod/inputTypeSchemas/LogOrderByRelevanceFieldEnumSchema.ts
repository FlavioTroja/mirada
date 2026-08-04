import { z } from 'zod';

export const LogOrderByRelevanceFieldEnumSchema = z.enum(['description','entityName','actionByUsername']);

export default LogOrderByRelevanceFieldEnumSchema;
