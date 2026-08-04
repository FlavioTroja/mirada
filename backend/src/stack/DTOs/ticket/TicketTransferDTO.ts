import { z } from "zod";

/**
 * `POST /tickets/:id/transfer` body `{ emailOrNickname }` (§3.7).
 *
 * Il corpo è **esattamente** quello del contratto: un solo campo. Il ruolo di
 * ballo del nuovo titolare **non si chiede**, si legge dal suo profilo
 * (`DancerProfile.preferredRole`) — `BOTH`, o l'assenza di profilo, significa
 * «tiene il ruolo che il biglietto già occupa», e quindi nessun movimento di
 * capienza (`05` §8: *trasferimento, stesso ruolo → nessun movimento*).
 *
 * Quando invece il ruolo cambia, il trasferimento **rilascia il vecchio e
 * impegna il nuovo nella stessa transazione**: se il nuovo ruolo è saturo il
 * trasferimento è rifiutato e **nulla cambia** (`RB8`, `RF-TCK-7`).
 */
export const TicketTransferRequestSchema = z.object({
    emailOrNickname: z.string().min(1),
});
export type TicketTransferRequestDTO = z.infer<typeof TicketTransferRequestSchema>;
