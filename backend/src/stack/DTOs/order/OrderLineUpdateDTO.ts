import { z } from "zod";
import { withToBeDisconnected } from "@utils/helpers/schemaTransformers";
import { OrderAttendeeSchema } from "@DTOs/order/OrderReserveDTO";

/**
 * Sub-risorsa `PATCH /orders/:id/lines` — **l'array intero** delle righe
 * dell'ordine (§3.2 e §3.4, regola 12 di `controllers.md`): `id: -1` = riga
 * nuova, `toBeDisconnected: true` = riga da rimuovere.
 *
 * ── Che cosa si può davvero cambiare, e perché non di più ────────────────────
 * Un ordine in `PENDING_PAYMENT` **ha già impegnato la capienza**: le sue righe
 * non sono un carrello, sono posti tolti dalla sala. Da qui si può quindi
 *  - **rimuovere** una riga — che rilascia i consumi corrispondenti, ed è la
 *    strada di `confirm-partial` (`RB17`);
 *  - **correggere i partecipanti** di una riga — un nome sbagliato, un'email
 *    con un refuso.
 *
 * **Non** si può cambiare la quantità né aggiungere una riga nuova: sarebbero un
 * nuovo impegno di capienza, che può essere rifiutato, e un `PATCH` che a metà
 * scopre di non avere più posto lascerebbe l'ordine in uno stato che nessuno ha
 * chiesto. Quella strada è `POST /orders/reserve`, che è atomica per costruzione.
 * Il servizio rifiuta con `400` e lo dice.
 *
 * **Nessun prezzo** compare qui: `unitPrice`, `presaleRightsPerUnit` e
 * `lineTotal` sono calcolati dal server (§4.11) e vengono **ricalcolati** dal
 * servizio a ogni modifica, mai accettati.
 */
export const OrderLineUpdateItemSchema = withToBeDisconnected(
    z.object({
        id: z.number().int(),
        attendees: OrderAttendeeSchema.array().optional(),
    }),
);

export const OrderLineUpdateSchema = OrderLineUpdateItemSchema.array();
export type OrderLineUpdateDTO = z.infer<typeof OrderLineUpdateSchema>;
