import { z } from "zod";

/**
 * Payload of `Events.CALENDAR_CHANGED` (`20-calendario.md`).
 *
 * Notifica e invito a rileggere, mai un canale di dati — la stessa disciplina di
 * `BalanceSettledPayloadDTO`. Un appuntamento dello staff ha un titolo e una
 * nota; una lezione il nome di un corso: nessuno dei due passa di qui, perché
 * un fotogramma non attraversa il controllo di permesso della rotta.
 */
export const CalendarChangedPayloadSchema = z.object({
    organizationId: z.number().int(),
    /** Il primo istante toccato. La vista ricarica solo se il suo periodo lo interseca. */
    from: z.string().datetime(),
    /** L'ultimo istante toccato. */
    to: z.string().datetime(),
    /** Che cosa è cambiato: basta a decidere quale delle tre letture ripetere. */
    source: z.enum(["SESSION", "EVENT", "APPOINTMENT"]),
});

export type CalendarChangedPayloadDTO = z.infer<typeof CalendarChangedPayloadSchema>;
