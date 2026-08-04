import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const VenueQuerySchema = z.object({
    value: z.string().optional(),
    organizationId: z.number().int().optional(),
    accessibleOnly: z.boolean().optional(),
});
export type VenueQueryDTO = z.infer<typeof VenueQuerySchema>;

export const VenuePaginateBodyInputSchema = paginateSchema(VenueQuerySchema);
export type VenuePaginateDTO = z.infer<typeof VenuePaginateBodyInputSchema>;
