import { z } from "zod";
import { EventCastOptionalDefaultsSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

export const EventCastCreateSchema = withoutMetadata(EventCastOptionalDefaultsSchema);
export type EventCastCreateDTO = z.infer<typeof EventCastCreateSchema>;
