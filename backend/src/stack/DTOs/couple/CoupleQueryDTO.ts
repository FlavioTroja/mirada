import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const CoupleQuerySchema = z.object({
    value: z.string().optional(),
    eventId: z.number().int().optional(),
    dissolved: z.boolean().optional(),
});
export type CoupleQueryDTO = z.infer<typeof CoupleQuerySchema>;

export const CouplePaginateBodyInputSchema = paginateSchema(CoupleQuerySchema);
export type CouplePaginateDTO = z.infer<typeof CouplePaginateBodyInputSchema>;
