import { z } from "zod";

/** Corpo di `POST /events/:id/cancel` (`RF-EVT-41`). */
export const EventCancelSchema = z.object({
    reason: z.string().min(1, "La motivazione dell'annullamento è obbligatoria."),
});
export type EventCancelDTO = z.infer<typeof EventCancelSchema>;

/**
 * Corpo di `POST /events/:id/orphan-sessions/resolve` (`RF-EVT-24`): la sessione
 * aggiunta all'evento pubblicato di cui si vuole conoscere l'impatto sui titoli.
 */
export const OrphanSessionsResolveSchema = z.object({
    sessionId: z.number().int(),
});
export type OrphanSessionsResolveDTO = z.infer<typeof OrphanSessionsResolveSchema>;

/**
 * Esito di `orphan-sessions/resolve`: i titoli che NON includono la sessione,
 * distinti fra venduti e invenduti. Sui venduti l'aggiunta è ammessa solo come
 * miglioria; la rimozione è sempre rifiutata (§4.5).
 */
export const OrphanSessionsResolutionSchema = z.object({
    sessionId: z.number().int(),
    ticketTypesWithoutSession: z.object({
        id: z.number().int(),
        name: z.unknown(),
        issuedTicketCount: z.number().int(),
        sold: z.boolean(),
        canAddSession: z.boolean(),
    }).array(),
});
export type OrphanSessionsResolutionDTO = z.infer<typeof OrphanSessionsResolutionSchema>;
