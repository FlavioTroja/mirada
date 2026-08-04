import { RoleName } from "@prisma/client";
import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const HiddenComponentConfigQuerySchema = z.object({
    value: z.string().optional(),
    isActive: z.boolean().optional(),
    roles: z.enum(RoleName).array().optional(),
});
export type HiddenComponentConfigQueryDTO = z.infer<typeof HiddenComponentConfigQuerySchema>;

export const HiddenComponentConfigPaginateBodyInputSchema = paginateSchema(HiddenComponentConfigQuerySchema);
export type HiddenComponentConfigPaginateDTO = z.infer<typeof HiddenComponentConfigPaginateBodyInputSchema>;