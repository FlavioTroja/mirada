import { z } from 'zod';

export const QuotaScopeSchema = z.enum(['EVENT','SESSION','TICKET_TYPE','SERVICE']);

export type QuotaScopeType = `${z.infer<typeof QuotaScopeSchema>}`

export default QuotaScopeSchema;
