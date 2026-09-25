import { z } from "zod";
import { SeriesScopeSchema } from "@DTOs/calendar/SeriesScopeDTO";
import { I18nTextSchema } from "@utils/helpers/i18nText";

/**
 * `PATCH /sessions/:id/series` — «questo e i successivi» o «tutti»
 * (`20-calendario.md` §5.1).
 *
 * `startAt`/`endAt` sono i nuovi orari **dell'occorrenza da cui si parte**: il
 * server ne prende l'ora d'orologio e la durata e le applica a ogni occorrenza,
 * ciascuna nel suo giorno. Spostarla di giorno è rifiutato: «tutte le lezioni al
 * mercoledì» è cancellare e ricreare, e va detto così.
 */
export const SessionSeriesUpdateSchema = z.object({
    scope: SeriesScopeSchema,
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    name: I18nTextSchema.optional(),
    room: z.string().nullish(),
    level: z.string().nullish(),
});
export type SessionSeriesUpdateDTO = z.infer<typeof SessionSeriesUpdateSchema>;
