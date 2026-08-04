import { z } from "zod";
import { RegistrationSchema } from "@prisma-gen/zod";

export const RegistrationResponseSchema = RegistrationSchema;
export type RegistrationResponseDTO = z.infer<typeof RegistrationResponseSchema>;
