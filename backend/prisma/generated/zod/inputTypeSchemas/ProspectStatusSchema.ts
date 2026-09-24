import { z } from 'zod';

export const ProspectStatusSchema = z.enum(['TO_CONTACT','CONTACTED','NOT_INTERESTED']);

export type ProspectStatusType = `${z.infer<typeof ProspectStatusSchema>}`

export default ProspectStatusSchema;
