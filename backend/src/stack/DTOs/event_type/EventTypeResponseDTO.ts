import { z } from "zod";
import { EventTypeSchema } from "@prisma-gen/zod";

export const EventTypeResponseSchema = EventTypeSchema;
export type EventTypeResponseDTO = z.infer<typeof EventTypeResponseSchema>;
