import { z } from "zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const TicketTransferQuerySchema = z.object({
    value: z.string().optional(),
    ticketId: z.number().int().optional(),
    fromUserId: z.number().int().optional(),
    toUserId: z.number().int().optional(),
});
export type TicketTransferQueryDTO = z.infer<typeof TicketTransferQuerySchema>;

export const TicketTransferPaginateBodyInputSchema = paginateSchema(TicketTransferQuerySchema);
export type TicketTransferPaginateDTO = z.infer<typeof TicketTransferPaginateBodyInputSchema>;
