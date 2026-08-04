import { z } from "zod";
import { RefundPolicySchema } from "@prisma-gen/zod";

export const RefundPolicyResponseSchema = RefundPolicySchema;
export type RefundPolicyResponseDTO = z.infer<typeof RefundPolicyResponseSchema>;
