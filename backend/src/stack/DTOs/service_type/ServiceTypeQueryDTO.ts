import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const ServiceTypeQuerySchema = z.object({
    active: z.boolean().optional(),
});
export type ServiceTypeQueryDTO = z.infer<typeof ServiceTypeQuerySchema>;

export const ServiceTypePaginateBodyInputSchema = paginateSchema(ServiceTypeQuerySchema);
export type ServiceTypePaginateDTO = z.infer<typeof ServiceTypePaginateBodyInputSchema>;
