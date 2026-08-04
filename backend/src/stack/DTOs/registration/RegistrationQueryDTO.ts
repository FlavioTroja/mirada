import { z } from "zod";
import { DanceRoleSchema, RegistrationChannelSchema, RegistrationStatusSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const RegistrationQuerySchema = z.object({
    value: z.string().optional(),
    eventId: z.number().int().optional(),
    assignedRole: DanceRoleSchema.optional(),
    status: RegistrationStatusSchema.optional(),
    channel: RegistrationChannelSchema.optional(),
    coupleId: z.number().int().optional(),
});
export type RegistrationQueryDTO = z.infer<typeof RegistrationQuerySchema>;

export const RegistrationPaginateBodyInputSchema = paginateSchema(RegistrationQuerySchema);
export type RegistrationPaginateDTO = z.infer<typeof RegistrationPaginateBodyInputSchema>;
