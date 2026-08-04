import { z } from "zod";
import { FiscalDeclarationKindSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const FiscalDeclarationQuerySchema = z.object({
    value: z.string().optional(),
    organizationId: z.number().int().optional(),
    eventId: z.number().int().optional(),
    kind: FiscalDeclarationKindSchema.optional(),
});
export type FiscalDeclarationQueryDTO = z.infer<typeof FiscalDeclarationQuerySchema>;

export const FiscalDeclarationPaginateBodyInputSchema = paginateSchema(FiscalDeclarationQuerySchema);
export type FiscalDeclarationPaginateDTO = z.infer<typeof FiscalDeclarationPaginateBodyInputSchema>;
