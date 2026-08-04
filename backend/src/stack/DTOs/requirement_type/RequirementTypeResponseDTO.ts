import { z } from "zod";
import { RequirementTypeSchema } from "@prisma-gen/zod";

export const RequirementTypeResponseSchema = RequirementTypeSchema;
export type RequirementTypeResponseDTO = z.infer<typeof RequirementTypeResponseSchema>;
