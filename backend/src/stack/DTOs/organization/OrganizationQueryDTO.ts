import { z } from "zod";
import { OrganizationStatus, PayoutStatus } from "@prisma/client";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const OrganizationQuerySchema = z.object({
    value: z.string().optional(),
    status: z.enum(OrganizationStatus).array().optional(),
    payoutStatus: z.enum(PayoutStatus).array().optional(),
});
export type OrganizationQueryDTO = z.infer<typeof OrganizationQuerySchema>;

export const OrganizationPaginateBodyInputSchema = paginateSchema(OrganizationQuerySchema);
export type OrganizationPaginateDTO = z.infer<typeof OrganizationPaginateBodyInputSchema>;
