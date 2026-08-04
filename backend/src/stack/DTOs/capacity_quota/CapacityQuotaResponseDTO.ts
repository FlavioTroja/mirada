import { z } from "zod";
import { CapacityQuotaSchema } from "@prisma-gen/zod";

export const CapacityQuotaResponseSchema = CapacityQuotaSchema;
export type CapacityQuotaResponseDTO = z.infer<typeof CapacityQuotaResponseSchema>;
