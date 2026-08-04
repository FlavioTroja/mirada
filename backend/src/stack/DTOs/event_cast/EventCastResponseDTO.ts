import { z } from "zod";
import { EventCastSchema } from "@prisma-gen/zod";

export const EventCastResponseSchema = EventCastSchema;
export type EventCastResponseDTO = z.infer<typeof EventCastResponseSchema>;
