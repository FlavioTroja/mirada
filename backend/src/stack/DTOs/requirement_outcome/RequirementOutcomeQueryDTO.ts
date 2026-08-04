import { z } from "zod";
import { RequirementOutcomeStatusSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const RequirementOutcomeQuerySchema = z.object({
    value: z.string().optional(),
    registrationId: z.number().int().optional(),
    eventRequirementId: z.number().int().optional(),
    eventId: z.number().int().optional(),
    status: RequirementOutcomeStatusSchema.optional(),
});
export type RequirementOutcomeQueryDTO = z.infer<typeof RequirementOutcomeQuerySchema>;

export const RequirementOutcomePaginateBodyInputSchema = paginateSchema(RequirementOutcomeQuerySchema);
export type RequirementOutcomePaginateDTO = z.infer<typeof RequirementOutcomePaginateBodyInputSchema>;
