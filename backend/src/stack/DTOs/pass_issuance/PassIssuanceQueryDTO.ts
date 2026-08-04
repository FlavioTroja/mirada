import { z } from "zod";
import { DanceRoleSchema, PassIssuanceReasonSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const PassIssuanceQuerySchema = z.object({
    value: z.string().optional(),
    eventId: z.number().int().optional(),
    ticketTypeId: z.number().int().optional(),
    reason: PassIssuanceReasonSchema.optional(),
    role: DanceRoleSchema.optional(),
    nominal: z.boolean().optional(),
});
export type PassIssuanceQueryDTO = z.infer<typeof PassIssuanceQuerySchema>;

export const PassIssuancePaginateBodyInputSchema = paginateSchema(PassIssuanceQuerySchema);
export type PassIssuancePaginateDTO = z.infer<typeof PassIssuancePaginateBodyInputSchema>;
