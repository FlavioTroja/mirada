import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const SessionQuerySchema = z.object({
    value: z.string().optional(),
    eventId: z.number().int().optional(),
    includeCancelled: z.boolean().optional(),
});
export type SessionQueryDTO = z.infer<typeof SessionQuerySchema>;

export const SessionPaginateBodyInputSchema = paginateSchema(SessionQuerySchema);
export type SessionPaginateDTO = z.infer<typeof SessionPaginateBodyInputSchema>;
