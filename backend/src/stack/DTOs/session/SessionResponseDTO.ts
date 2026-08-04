import { z } from "zod";
import { SessionSchema } from "@prisma-gen/zod";

export const SessionResponseSchema = SessionSchema;
export type SessionResponseDTO = z.infer<typeof SessionResponseSchema>;
