import { z } from 'zod';

export const SessionKindSchema = z.enum(['REGULAR','OPEN_DAY']);

export type SessionKindType = `${z.infer<typeof SessionKindSchema>}`

export default SessionKindSchema;
