import { z } from 'zod';

export const FileScalarFieldEnumSchema = z.enum(['id','name','path','url','mimeType','size','createdAt','updatedAt']);

export default FileScalarFieldEnumSchema;
