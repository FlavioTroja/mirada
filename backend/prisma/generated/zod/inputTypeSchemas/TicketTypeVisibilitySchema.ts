import { z } from 'zod';

export const TicketTypeVisibilitySchema = z.enum(['PUBLIC','CODE_RESTRICTED']);

export type TicketTypeVisibilityType = `${z.infer<typeof TicketTypeVisibilitySchema>}`

export default TicketTypeVisibilitySchema;
