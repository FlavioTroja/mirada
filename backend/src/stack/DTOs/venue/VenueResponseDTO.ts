import { z } from "zod";
import { VenueSchema } from "@prisma-gen/zod";

export const VenueResponseSchema = VenueSchema;
export type VenueResponseDTO = z.infer<typeof VenueResponseSchema>;
