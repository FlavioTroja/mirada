import { z } from "zod";

/**
 * `POST /api/orders/:id/confirm-partial` — §3.7, `RF-PAY-15`, `RB17`.
 *
 * **Conferma esplicita** dopo un `PARTIAL_AVAILABILITY`. Non è una formalità:
 * l'utente sta accettando di comprare **meno** di quanto aveva messo nel
 * carrello, e nessun sistema può decidere al posto suo che la cena non gli
 * interessava. Il totale si ricalcola sulle righe che restano.
 */
export const OrderConfirmPartialSchema = z.object({
    /** Le righe che l'utente accetta di rimuovere — quelle indisponibili. */
    removeLineIds: z.number().int().positive().array().min(1),
});
export type OrderConfirmPartialDTO = z.infer<typeof OrderConfirmPartialSchema>;

/**
 * `POST /api/orders/:id/confirm-free` — §3.7.
 *
 * **Chiude un ordine senza prestatore di pagamento**: risolve i ruoli
 * flessibili, conferma le `Registration`, emette i `Ticket`, rilascia la
 * `Reservation` con `releaseReason = COMPLETED` e registra un `Payment` con
 * `provider = NONE`. Percorre **esattamente lo stesso codice** di `checkout`,
 * meno l'adapter.
 *
 * ── Il presidio, che è tutto il punto di questo DTO ──────────────────────────
 * *«Ammesso **solo** se il totale è zero o se l'organizzatore ha dichiarato
 * l'incasso fuori piattaforma: **non è una scorciatoia per saltare il
 * pagamento**.»*
 *
 * A totale zero non serve dichiarare nulla: non c'è denaro. Sopra lo zero serve
 * **un atto esplicito di chi incassa**, e per questo `offPlatformPayment` non è
 * un booleano solitario: chiede anche il **motivo**, che finisce nel log e nella
 * riga di `Payment`. Il servizio verifica inoltre che a chiederlo sia un membro
 * dell'organizzazione che incassa — un partecipante non può dichiarare di aver
 * pagato fuori piattaforma, o il presidio sarebbe una casella da spuntare.
 */
export const OrderConfirmFreeSchema = z.object({
    offPlatformPayment: z.boolean().optional().default(false),
    /** Obbligatorio quando `offPlatformPayment` è vero: come e quando si è incassato. */
    offPlatformReason: z.string().min(3).max(500).optional(),
});
export type OrderConfirmFreeDTO = z.infer<typeof OrderConfirmFreeSchema>;
