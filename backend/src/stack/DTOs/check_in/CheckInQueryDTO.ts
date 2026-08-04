import { z } from "zod";
import { CheckInKindSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const CheckInQuerySchema = z.object({
    value: z.string().optional(),
    eventId: z.number().int().optional(),
    sessionId: z.number().int().optional(),
    ticketId: z.number().int().optional(),
    registrationId: z.number().int().optional(),
    operatorUserId: z.number().int().optional(),
    kind: CheckInKindSchema.optional(),
    offline: z.boolean().optional(),
    /** `true` = solo i conflitti aperti — è la lista di `/check-in/conflicts`. */
    conflictsOnly: z.boolean().optional(),
    /** `true` = comprende anche gli ingressi annullati. Di serie sono esclusi. */
    includeRevoked: z.boolean().optional(),
});
export type CheckInQueryDTO = z.infer<typeof CheckInQuerySchema>;

export const CheckInPaginateBodyInputSchema = paginateSchema(CheckInQuerySchema);
export type CheckInPaginateDTO = z.infer<typeof CheckInPaginateBodyInputSchema>;
