import z from "zod";
import { UiScope } from "@prisma/client";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const ConfigQuerySchema = z.object({
    name: z.string().optional(),
    scope: z.string().optional(),
    uiScope: z.enum(UiScope).optional(),
});
export type ConfigQueryDTO = z.infer<typeof ConfigQuerySchema>;

export const ConfigPaginateBodyInputSchema = paginateSchema(ConfigQuerySchema);
export type ConfigPaginateDTO = z.infer<typeof ConfigPaginateBodyInputSchema>;