import { z } from 'zod';

export const PermissionConfigOrderByRelevanceFieldEnumSchema = z.enum(['action','entity','scope']);

export default PermissionConfigOrderByRelevanceFieldEnumSchema;
