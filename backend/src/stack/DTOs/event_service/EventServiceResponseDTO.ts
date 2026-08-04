import { z } from "zod";
import { EventServiceSchema } from "@prisma-gen/zod";

export const EventServiceResponseSchema = EventServiceSchema;
export type EventServiceResponseDTO = z.infer<typeof EventServiceResponseSchema>;
