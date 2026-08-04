import { z } from "zod";
import { DanceRoleSchema } from "@prisma-gen/zod";

/**
 * `POST /api/public/events/:id/availability` — §3.7.
 *
 * **Sorgente del polling a 10–15 s** del pubblico anonimo, che non ha WebSocket
 * (§7 D-H). Il corpo è facoltativo: `role` permette di restringere la scarsità al
 * ruolo dell'utente, come prescrive `05` §10 («la quota più stretta fra quelle
 * applicabili **al ruolo dell'utente**»).
 */
export const EventAvailabilityRequestSchema = z.object({
    role: DanceRoleSchema.nullish(),
});
export type EventAvailabilityRequestDTO = z.infer<typeof EventAvailabilityRequestSchema>;

/**
 * Forma dichiarata dal §3.7:
 * `{ ticketTypes: [{ id, remaining, soldOut, roleOnHold, activeTier: { price, expiresAt?, remainingAtThisPrice? } }],
 *    roles: { leader, follower } }`
 *
 * ── Estensione additiva, dichiarata ──────────────────────────────────────────
 * Il §3.7 non tipizza `roles.leader` / `roles.follower` né `roleOnHold`. Qui
 * `roles` porta il **residuo per ruolo** (numero, `null` = quota non configurata)
 * e `roleOnHold` di ciascun titolo è un **booleano**, come i suoi fratelli
 * `remaining` e `soldOut`. Poiché un titolo senza vincolo di ruolo può essere
 * bloccato per un solo ruolo dei due, si aggiungono `rolesOnHold`, `imbalance` e
 * `imbalanceTolerance`: sono **campi in più**, nessun campo del §3.7 cambia forma
 * o sparisce, e il frontend che consuma solo il §3.7 continua a funzionare.
 */
export const TicketTypeAvailabilitySchema = z.object({
    id: z.number().int(),
    /** `null` = nessuna quota pubblica applicabile, cioè nessun vincolo da mostrare. */
    remaining: z.number().int().nullable(),
    soldOut: z.boolean(),
    roleOnHold: z.boolean(),
    activeTier: z.object({
        price: z.number().int(),
        expiresAt: z.date().nullable(),
        remainingAtThisPrice: z.number().int().nullable(),
    }),
});

export const EventAvailabilityResponseSchema = z.object({
    eventId: z.number().int(),
    ticketTypes: TicketTypeAvailabilitySchema.array(),
    roles: z.object({
        leader: z.number().int().nullable(),
        follower: z.number().int().nullable(),
    }),
    rolesOnHold: z.object({
        leader: z.boolean(),
        follower: z.boolean(),
    }),
    imbalance: z.number().int().nullable(),
    imbalanceTolerance: z.number().int().nullable(),
});
export type EventAvailabilityResponseDTO = z.infer<typeof EventAvailabilityResponseSchema>;
