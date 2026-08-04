import { z } from "zod";
import { EventRequirementSchema } from "@prisma-gen/zod";

export const EventRequirementResponseSchema = EventRequirementSchema;
export type EventRequirementResponseDTO = z.infer<typeof EventRequirementResponseSchema>;
