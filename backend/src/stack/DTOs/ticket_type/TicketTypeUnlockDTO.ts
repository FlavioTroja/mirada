import { z } from "zod";

/** `POST /api/public/ticket-types/:id/unlock` (`RF-EVT-7`) — senza autenticazione. */
export const TicketTypeUnlockSchema = z.object({
    accessCode: z.string().min(1, "Il codice di accesso è obbligatorio."),
});
export type TicketTypeUnlockDTO = z.infer<typeof TicketTypeUnlockSchema>;
