import { z } from "zod";
import { OrgMemberRole } from "@prisma/client";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const OrganizationMemberQuerySchema = z.object({
    organizationId: z.number().int().optional(),
    userId: z.number().int().optional(),
    role: z.enum(OrgMemberRole).array().optional(),
    accepted: z.boolean().optional(),
});
export type OrganizationMemberQueryDTO = z.infer<typeof OrganizationMemberQuerySchema>;

export const OrganizationMemberPaginateBodyInputSchema = paginateSchema(OrganizationMemberQuerySchema);
export type OrganizationMemberPaginateDTO = z.infer<typeof OrganizationMemberPaginateBodyInputSchema>;
