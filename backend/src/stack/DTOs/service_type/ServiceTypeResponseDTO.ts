import { z } from "zod";
import { ServiceTypeSchema } from "@prisma-gen/zod";

export const ServiceTypeResponseSchema = ServiceTypeSchema;
export type ServiceTypeResponseDTO = z.infer<typeof ServiceTypeResponseSchema>;
