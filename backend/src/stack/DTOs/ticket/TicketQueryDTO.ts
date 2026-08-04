import { z } from "zod";
import { TicketStatusSchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

/** Le colonne di `/tickets`: codice, titolare, titolo, stato, al portatore, emesso il. */
export const TicketQuerySchema = z.object({
    value: z.string().optional(),
    eventId: z.number().int().optional(),
    ticketTypeId: z.number().int().optional(),
    registrationId: z.number().int().optional(),
    passIssuanceId: z.number().int().optional(),
    status: TicketStatusSchema.optional(),
    bearer: z.boolean().optional(),
});
export type TicketQueryDTO = z.infer<typeof TicketQuerySchema>;

export const TicketPaginateBodyInputSchema = paginateSchema(TicketQuerySchema);
export type TicketPaginateDTO = z.infer<typeof TicketPaginateBodyInputSchema>;
