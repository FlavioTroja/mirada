import { z } from "zod";
import { DanceRoleSchema, QuotaReservedForSchema, QuotaScopeSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const CapacityQuotaQuerySchema = z.object({
    value: z.string().optional(),
    eventId: z.number().int().optional(),
    scope: QuotaScopeSchema.optional(),
    scopeId: z.number().int().optional(),
    role: DanceRoleSchema.optional(),
    reservedFor: QuotaReservedForSchema.optional(),
    limiting: z.boolean().optional(),
});
export type CapacityQuotaQueryDTO = z.infer<typeof CapacityQuotaQuerySchema>;

export const CapacityQuotaPaginateBodyInputSchema = paginateSchema(CapacityQuotaQuerySchema);
export type CapacityQuotaPaginateDTO = z.infer<typeof CapacityQuotaPaginateBodyInputSchema>;
