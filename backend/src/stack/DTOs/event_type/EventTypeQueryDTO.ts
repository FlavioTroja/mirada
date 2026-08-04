import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const EventTypeQuerySchema = z.object({
    value: z.string().optional(),
    active: z.boolean().optional(),
    slug: z.string().optional(),
});
export type EventTypeQueryDTO = z.infer<typeof EventTypeQuerySchema>;

export const EventTypePaginateBodyInputSchema = paginateSchema(EventTypeQuerySchema);
export type EventTypePaginateDTO = z.infer<typeof EventTypePaginateBodyInputSchema>;
