import { z } from 'zod';

export const FileOrderByRelevanceFieldEnumSchema = z.enum(['name','path','url','mimeType']);

export default FileOrderByRelevanceFieldEnumSchema;
