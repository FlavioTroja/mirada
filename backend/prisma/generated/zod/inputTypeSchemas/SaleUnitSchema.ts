import { z } from 'zod';

export const SaleUnitSchema = z.enum(['PER_PERSON','PER_COUPLE']);

export type SaleUnitType = `${z.infer<typeof SaleUnitSchema>}`

export default SaleUnitSchema;
