import { z } from "zod";
import { BalanceSettlementMethodSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const BalanceSettlementQuerySchema = z.object({
    value: z.string().optional(),
    eventId: z.number().int().optional(),
    registrationId: z.number().int().optional(),
    operatorUserId: z.number().int().optional(),
    method: BalanceSettlementMethodSchema.optional(),
    deviceId: z.string().optional(),
    offline: z.boolean().optional(),
    /** `true` = solo le righe in conflitto — il doppio incasso da risolvere. */
    conflictsOnly: z.boolean().optional(),
});
export type BalanceSettlementQueryDTO = z.infer<typeof BalanceSettlementQuerySchema>;

export const BalanceSettlementPaginateBodyInputSchema = paginateSchema(BalanceSettlementQuerySchema);
export type BalanceSettlementPaginateDTO = z.infer<typeof BalanceSettlementPaginateBodyInputSchema>;
