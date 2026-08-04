import { z } from "zod";
import { FiscalDeclarationSchema } from "@prisma-gen/zod";

export const FiscalDeclarationResponseSchema = FiscalDeclarationSchema;
export type FiscalDeclarationResponseDTO = z.infer<typeof FiscalDeclarationResponseSchema>;
