import { z } from "zod";
import { CoupleSchema } from "@prisma-gen/zod";

export const CoupleResponseSchema = CoupleSchema;
export type CoupleResponseDTO = z.infer<typeof CoupleResponseSchema>;
