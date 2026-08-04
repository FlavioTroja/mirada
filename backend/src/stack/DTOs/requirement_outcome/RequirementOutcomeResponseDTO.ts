import { z } from "zod";
import { RequirementOutcomeSchema } from "@prisma-gen/zod";

export const RequirementOutcomeResponseSchema = RequirementOutcomeSchema;
export type RequirementOutcomeResponseDTO = z.infer<typeof RequirementOutcomeResponseSchema>;
