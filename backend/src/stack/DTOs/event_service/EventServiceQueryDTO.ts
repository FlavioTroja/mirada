import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const EventServiceQuerySchema = z.object({
    eventId: z.number().int().optional(),
    serviceTypeId: z.number().int().optional(),
});
export type EventServiceQueryDTO = z.infer<typeof EventServiceQuerySchema>;

export const EventServicePaginateBodyInputSchema = paginateSchema(EventServiceQuerySchema);
export type EventServicePaginateDTO = z.infer<typeof EventServicePaginateBodyInputSchema>;
