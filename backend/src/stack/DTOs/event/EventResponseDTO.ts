import { z } from "zod";
import { EventSchema } from "@prisma-gen/zod";

export const EventResponseSchema = EventSchema;
export type EventResponseDTO = z.infer<typeof EventResponseSchema>;
