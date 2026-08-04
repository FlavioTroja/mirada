import { z } from "zod";
import { EventStatusSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const EventQuerySchema = z.object({
    value: z.string().optional(),
    status: EventStatusSchema.array().optional(),
    organizationId: z.number().int().optional(),
    eventTypeId: z.number().int().optional(),
    venueId: z.number().int().optional(),
});
export type EventQueryDTO = z.infer<typeof EventQuerySchema>;

export const EventPaginateBodyInputSchema = paginateSchema(EventQuerySchema);
export type EventPaginateDTO = z.infer<typeof EventPaginateBodyInputSchema>;
