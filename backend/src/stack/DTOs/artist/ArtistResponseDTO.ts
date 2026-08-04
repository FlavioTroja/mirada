import { z } from "zod";
import { ArtistSchema } from "@prisma-gen/zod";

export const ArtistResponseSchema = ArtistSchema;
export type ArtistResponseDTO = z.infer<typeof ArtistResponseSchema>;
