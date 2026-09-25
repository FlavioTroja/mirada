import { z } from "zod";
import { MAX_CALENDAR_RANGE_DAYS } from "@utils/helpers/recurrence";

/**
 * Il periodo che una vista del calendario chiede: `from` incluso, `to` escluso.
 *
 * Al più `MAX_CALENDAR_RANGE_DAYS` giorni — un mese con le code della griglia.
 * Le rotte `…/calendar` non sono paginate, e un intervallo senza tetto sarebbe
 * un elenco senza tetto.
 */
export const CalendarRangeSchema = z
    .object({
        from: z.coerce.date(),
        to: z.coerce.date(),
    })
    .refine(r => r.to.getTime() > r.from.getTime(), {
        message: "La fine dell'intervallo deve seguire l'inizio.",
    })
    .refine(r => r.to.getTime() - r.from.getTime() <= MAX_CALENDAR_RANGE_DAYS * 86_400_000, {
        message: `Il calendario si legge al più ${MAX_CALENDAR_RANGE_DAYS} giorni alla volta.`,
    });
export type CalendarRangeDTO = z.infer<typeof CalendarRangeSchema>;
