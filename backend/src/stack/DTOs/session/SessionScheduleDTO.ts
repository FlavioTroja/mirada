import { z } from "zod";
import { Session } from "@prisma/client";
import { SessionCreateSchema } from "@DTOs/session/SessionCreateDTO";
import { RecurrenceSchema } from "@DTOs/calendar/RecurrenceDTO";

/**
 * `POST /sessions/schedule` — creare dal calendario una lezione, un open day o
 * una sessione, **anche in serie** (`20-calendario.md` §5).
 *
 * Il calendario passa sempre di qui, anche per «non si ripete»: è qui che le
 * lezioni nuove entrano nei titoli che le comprendevano già tutte (K3), e una
 * lezione creata da sola dal calendario non deve comportarsi diversamente da
 * una creata in serie.
 *
 * Niente `allocationWeight` né `sortOrder`: li decide il servizio, come per una
 * sessione creata senza.
 */
export const SessionScheduleSchema = SessionCreateSchema.omit({
    allocationWeight: true,
    sortOrder: true,
}).extend({
    recurrence: RecurrenceSchema.optional(),
});
export type SessionScheduleDTO = z.infer<typeof SessionScheduleSchema>;

/** Un titolo che si è allungato: il calendario lo dice all'utente. */
export type ExtendedTicketTypeDTO = { id: number; name: unknown; addedSessions: number };

export type SessionScheduleResultDTO = {
    sessions: Session[];
    extendedTicketTypes: ExtendedTicketTypeDTO[];
};
