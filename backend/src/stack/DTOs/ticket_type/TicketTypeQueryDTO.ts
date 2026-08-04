import { z } from "zod";
import { TicketTypeVisibilitySchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const TicketTypeQuerySchema = z.object({
    value: z.string().optional(),
    eventId: z.number().int().optional(),
    visibility: TicketTypeVisibilitySchema.optional(),
    highlighted: z.boolean().optional(),
});
export type TicketTypeQueryDTO = z.infer<typeof TicketTypeQuerySchema>;

export const TicketTypePaginateBodyInputSchema = paginateSchema(TicketTypeQuerySchema);
export type TicketTypePaginateDTO = z.infer<typeof TicketTypePaginateBodyInputSchema>;
