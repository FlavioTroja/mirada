import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

/**
 * §4.9 — `QuotaConsumption` è **sola lettura**: nessun `Create`, nessun `Update`.
 * Si scrive solo attraverso il servizio di capienza.
 */
export const QuotaConsumptionQuerySchema = z.object({
    value: z.string().optional(),
    capacityQuotaId: z.number().int().optional(),
    registrationId: z.number().int().optional(),
});
export type QuotaConsumptionQueryDTO = z.infer<typeof QuotaConsumptionQuerySchema>;

export const QuotaConsumptionPaginateBodyInputSchema = paginateSchema(QuotaConsumptionQuerySchema);
export type QuotaConsumptionPaginateDTO = z.infer<typeof QuotaConsumptionPaginateBodyInputSchema>;
