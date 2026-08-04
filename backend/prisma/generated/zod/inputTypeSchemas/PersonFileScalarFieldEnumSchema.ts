import { z } from 'zod';

export const PersonFileScalarFieldEnumSchema = z.enum(['personId','fileId','createdAt']);

export default PersonFileScalarFieldEnumSchema;
