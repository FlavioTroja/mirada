import { z } from 'zod';

export const PriceTierKindSchema = z.enum(['BY_DATE','BY_QUANTITY','COMBINED']);

export type PriceTierKindType = `${z.infer<typeof PriceTierKindSchema>}`

export default PriceTierKindSchema;
