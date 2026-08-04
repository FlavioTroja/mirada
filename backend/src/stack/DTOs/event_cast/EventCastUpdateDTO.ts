import { z } from "zod";
import { EventCastPartialSchema } from "@prisma-gen/zod";
import { withoutMetadata } from "@utils/helpers/schemaTransformers";

/** Solo scalari della propria riga — regola 11 di controllers.md. */
export const EventCastUpdateSchema = withoutMetadata(EventCastPartialSchema).omit({ eventId: true });
export type EventCastUpdateDTO = z.infer<typeof EventCastUpdateSchema>;
