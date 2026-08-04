import { z } from "zod";
import { ArtistKind } from "@prisma/client";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const ArtistQuerySchema = z.object({
    value: z.string().optional(),
    organizationId: z.number().int().optional(),
    kind: z.enum(ArtistKind).array().optional(),
});
export type ArtistQueryDTO = z.infer<typeof ArtistQuerySchema>;

export const ArtistPaginateBodyInputSchema = paginateSchema(ArtistQuerySchema);
export type ArtistPaginateDTO = z.infer<typeof ArtistPaginateBodyInputSchema>;
