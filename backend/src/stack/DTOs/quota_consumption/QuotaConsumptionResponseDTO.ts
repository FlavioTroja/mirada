import { z } from "zod";
import { QuotaConsumptionSchema } from "@prisma-gen/zod";

export const QuotaConsumptionResponseSchema = QuotaConsumptionSchema;
export type QuotaConsumptionResponseDTO = z.infer<typeof QuotaConsumptionResponseSchema>;
