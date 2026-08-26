import { z } from 'zod';

export const BalanceSettlementMethodSchema = z.enum(['CASH','POS','SATISPAY','BANK_TRANSFER','OTHER']);

export type BalanceSettlementMethodType = `${z.infer<typeof BalanceSettlementMethodSchema>}`

export default BalanceSettlementMethodSchema;
