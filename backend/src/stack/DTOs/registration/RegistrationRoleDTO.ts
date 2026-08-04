import { z } from "zod";
import { DanceRoleSchema } from "@prisma-gen/zod";

/**
 * Corpo di `POST /registrations/:id/reassign-role` (§4.10).
 *
 * La riassegnazione **rilascia i consumi del vecchio ruolo e impegna quelli del
 * nuovo nella stessa transazione**: se il nuovo ruolo è saturo l'operazione è
 * rifiutata e nulla cambia (`05` §8).
 *
 * `ticketTypeId` e `serviceIds` descrivono che cosa l'iscrizione occupa: senza,
 * il nuovo impegno ricadrebbe sulle sole quote di evento e la sessione tornerebbe
 * libera senza che nessuno l'abbia liberata.
 */
export const RegistrationRoleReassignSchema = z.object({
    role: DanceRoleSchema,
    ticketTypeId: z.number().int().nullish(),
    serviceIds: z.number().int().array().optional(),
});
export type RegistrationRoleReassignDTO = z.infer<typeof RegistrationRoleReassignSchema>;

/** Corpo di `POST /registrations/:id/decline` (`RB24`). */
export const RegistrationDeclineSchema = z.object({
    reason: z.string().optional(),
});
export type RegistrationDeclineDTO = z.infer<typeof RegistrationDeclineSchema>;
