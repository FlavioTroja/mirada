import { z } from "zod";

/**
 * La ripetizione settimanale del calendario — `20-calendario.md` §5. Il calcolo
 * delle occorrenze sta in `@utils/helpers/recurrence`.
 */
export const RecurrenceSchema = z
    .object({
        /** Giorni della settimana, lunedì = 1 … domenica = 7. */
        weekdays: z
            .array(z.number().int().min(1).max(7))
            .min(1, "Scegli almeno un giorno della settimana."),
        /** Ultimo giorno, **incluso**, come data locale `AAAA-MM-GG`. */
        until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida.").optional(),
        /** In alternativa a `until`: quante occorrenze in tutto, la prima compresa. */
        count: z.number().int().min(1).optional(),
    })
    .refine(r => (r.until === undefined) !== (r.count === undefined), {
        message: "Indica fino a quando si ripete oppure quante volte, non entrambi.",
    });
export type RecurrenceDTO = z.infer<typeof RecurrenceSchema>;
