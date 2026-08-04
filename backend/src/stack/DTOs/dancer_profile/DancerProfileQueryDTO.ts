import { z } from "zod";
import { PreferredDanceRole } from "@prisma/client";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const DancerProfileQuerySchema = z.object({
    value: z.string().optional(),
    preferredRole: z.enum(PreferredDanceRole).array().optional(),
    city: z.string().optional(),
});
export type DancerProfileQueryDTO = z.infer<typeof DancerProfileQuerySchema>;

export const DancerProfilePaginateBodyInputSchema = paginateSchema(DancerProfileQuerySchema);
export type DancerProfilePaginateDTO = z.infer<typeof DancerProfilePaginateBodyInputSchema>;
