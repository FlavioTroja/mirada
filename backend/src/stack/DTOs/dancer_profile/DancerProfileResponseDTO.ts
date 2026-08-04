import { z } from "zod";
import { DancerProfileSchema } from "@prisma-gen/zod";

export const DancerProfileResponseSchema = DancerProfileSchema;
export type DancerProfileResponseDTO = z.infer<typeof DancerProfileResponseSchema>;
