import { z } from "zod";
import { RequirementKind } from "@prisma/client";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const RequirementTypeQuerySchema = z.object({
    active: z.boolean().optional(),
    kind: z.enum(RequirementKind).optional(),
});
export type RequirementTypeQueryDTO = z.infer<typeof RequirementTypeQuerySchema>;

export const RequirementTypePaginateBodyInputSchema = paginateSchema(RequirementTypeQuerySchema);
export type RequirementTypePaginateDTO = z.infer<typeof RequirementTypePaginateBodyInputSchema>;
