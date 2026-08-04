import { z } from 'zod';

export const FiscalDeclarationKindSchema = z.enum(['ORGANIZATION_FRAMEWORK','EVENT_ATTESTATION']);

export type FiscalDeclarationKindType = `${z.infer<typeof FiscalDeclarationKindSchema>}`

export default FiscalDeclarationKindSchema;
