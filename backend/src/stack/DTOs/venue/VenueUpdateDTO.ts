import { z } from "zod";
import { VenuePartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const VenueUpdateSchema = withoutMetadata(VenuePartialSchema);
export type VenueUpdateDTO = z.infer<typeof VenueUpdateSchema>;
