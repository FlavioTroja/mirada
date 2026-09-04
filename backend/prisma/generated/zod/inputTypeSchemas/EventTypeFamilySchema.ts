import { z } from 'zod';

export const EventTypeFamilySchema = z.enum(['EVENT','COURSE']);

export type EventTypeFamilyType = `${z.infer<typeof EventTypeFamilySchema>}`

export default EventTypeFamilySchema;
