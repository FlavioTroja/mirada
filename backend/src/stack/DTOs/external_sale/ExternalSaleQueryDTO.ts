import { z } from "zod";
import { ExternalSaleStatusSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const ExternalSaleQuerySchema = z.object({
    /** Cerca su acquirente e numero d'ordine del negozio. */
    value: z.string().optional(),
    salesChannelId: z.number().int().optional(),
    eventId: z.number().int().optional(),
    status: ExternalSaleStatusSchema.optional(),
});
export type ExternalSaleQueryDTO = z.infer<typeof ExternalSaleQuerySchema>;

export const ExternalSalePaginateBodyInputSchema = paginateSchema(ExternalSaleQuerySchema);
export type ExternalSalePaginateDTO = z.infer<typeof ExternalSalePaginateBodyInputSchema>;
