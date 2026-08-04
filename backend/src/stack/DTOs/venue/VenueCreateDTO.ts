import { z } from "zod";
import { VenueOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

export const VenueCreateSchema = withoutMetadata(VenueOptionalDefaultsSchema);
export type VenueCreateDTO = z.infer<typeof VenueCreateSchema>;
