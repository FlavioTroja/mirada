import { z } from "zod";
import { EventStatusSchema, EventTypeFamilySchema } from "@prisma-gen/zod";
import { paginateSchema } from "@utils/helpers/schemaTransformers";

export const EventQuerySchema = z.object({
    value: z.string().optional(),
    status: EventStatusSchema.array().optional(),
    organizationId: z.number().int().optional(),
    eventTypeId: z.number().int().optional(),
    /**
     * **La famiglia del tipo evento**, non il tipo.
     *
     * È ciò che separa le due liste del back-office: `/events` mostra la famiglia
     * `EVENT`, `/courses` la famiglia `COURSE`. Filtrare per `eventTypeId` non
     * basterebbe — le famiglie contengono più tipi, e il giorno in cui nasce
     * «Corso serale» una lista costruita sugli id andrebbe aggiornata a mano.
     */
    eventTypeFamily: EventTypeFamilySchema.optional(),
    venueId: z.number().int().optional(),
});
export type EventQueryDTO = z.infer<typeof EventQuerySchema>;

export const EventPaginateBodyInputSchema = paginateSchema(EventQuerySchema);
export type EventPaginateDTO = z.infer<typeof EventPaginateBodyInputSchema>;
