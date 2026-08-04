import { z } from "zod";
import { ArtistKindSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const EventCastQuerySchema = z.object({
    eventId: z.number().int().optional(),
    artistId: z.number().int().optional(),
    kind: ArtistKindSchema.optional(),
});
export type EventCastQueryDTO = z.infer<typeof EventCastQuerySchema>;

export const EventCastPaginateBodyInputSchema = paginateSchema(EventCastQuerySchema);
export type EventCastPaginateDTO = z.infer<typeof EventCastPaginateBodyInputSchema>;
