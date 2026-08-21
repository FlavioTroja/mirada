import { z } from "zod";
import { SalesChannelProviderSchema, SalesChannelStatusSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const SalesChannelQuerySchema = z.object({
    value: z.string().optional(),
    organizationId: z.number().int().optional(),
    provider: SalesChannelProviderSchema.optional(),
    status: SalesChannelStatusSchema.optional(),
});
export type SalesChannelQueryDTO = z.infer<typeof SalesChannelQuerySchema>;

export const SalesChannelPaginateBodyInputSchema = paginateSchema(SalesChannelQuerySchema);
export type SalesChannelPaginateDTO = z.infer<typeof SalesChannelPaginateBodyInputSchema>;
