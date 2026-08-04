import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const RefundPolicyQuerySchema = z.object({
    organizationId: z.number().int().optional(),
    isPlatformPreset: z.boolean().optional(),
});
export type RefundPolicyQueryDTO = z.infer<typeof RefundPolicyQuerySchema>;

export const RefundPolicyPaginateBodyInputSchema = paginateSchema(RefundPolicyQuerySchema);
export type RefundPolicyPaginateDTO = z.infer<typeof RefundPolicyPaginateBodyInputSchema>;
