import { z } from "zod";
import { RequirementBlockingSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const EventRequirementQuerySchema = z.object({
    eventId: z.number().int().optional(),
    requirementTypeId: z.number().int().optional(),
    blocking: RequirementBlockingSchema.optional(),
    mandatory: z.boolean().optional(),
});
export type EventRequirementQueryDTO = z.infer<typeof EventRequirementQuerySchema>;

export const EventRequirementPaginateBodyInputSchema = paginateSchema(EventRequirementQuerySchema);
export type EventRequirementPaginateDTO = z.infer<typeof EventRequirementPaginateBodyInputSchema>;
