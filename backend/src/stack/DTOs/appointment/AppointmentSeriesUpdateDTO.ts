import { z } from "zod";
import { SeriesScopeSchema } from "@DTOs/calendar/SeriesScopeDTO";

/**
 * `PATCH /appointments/:id/series` — come `SessionSeriesUpdateDTO`: gli orari
 * sono quelli dell'occorrenza da cui si parte, e ogni occorrenza resta nel suo
 * giorno.
 */
export const AppointmentSeriesUpdateSchema = z.object({
    scope: SeriesScopeSchema,
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    title: z.string().trim().min(1, "Indica un titolo.").optional(),
    note: z.string().nullish(),
    room: z.string().nullish(),
    venueId: z.number().int().nullish(),
});
export type AppointmentSeriesUpdateDTO = z.infer<typeof AppointmentSeriesUpdateSchema>;
