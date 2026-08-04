import { z } from 'zod';

export const RequirementKindSchema = z.enum(['DECLARATION','CUSTOM_FIELD']);

export type RequirementKindType = `${z.infer<typeof RequirementKindSchema>}`

export default RequirementKindSchema;
