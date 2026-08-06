import { z } from "zod";

/**
 * Esito di `POST /api/orders/reserve` — §3.7: `{ purchase, orders[], expiresAt }`.
 *
 * ── I due campi in più, e perché ci sono ─────────────────────────────────────
 *
 * - **`overlaps`** — `RF-PAY-26`: la sovrapposizione fra titoli si **segnala
 *   senza bloccare**. Senza un campo che la porti, «segnalare» non avrebbe un
 *   destinatario: l'utente che compra un Full Pass e un Workshop sulla stessa
 *   serata deve sapere che quella serata è già inclusa, e decidere lui. La quota
 *   di quella sessione **non è consumata due volte**, il che è il vero effetto;
 *   l'avviso è il modo in cui glielo si dice.
 * - **`registrationIds`** — le iscrizioni create, che il chiamante deve poter
 *   nominare per confermare, rifiutare o riassegnare un ruolo (§3.7).
 *
 * Nessun campo del §3.7 cambia forma o sparisce: sono **aggiunte**.
 */
export const OrderOverlapSchema = z.object({
    registrationId: z.number().int(),
    holderEmail: z.string(),
    sessionId: z.number().int(),
    /** Titoli della stessa persona che includono entrambi quella sessione. */
    ticketTypeIds: z.number().int().array(),
});
export type OrderOverlapDTO = z.infer<typeof OrderOverlapSchema>;

export const OrderReserveResponseSchema = z.object({
    purchase: z.any(),
    orders: z.any().array(),
    /** `now + 15 min` — parametro di piattaforma, sempre attivo (`RF-PAY-25`). */
    expiresAt: z.date(),
    registrationIds: z.number().int().array(),
    overlaps: OrderOverlapSchema.array(),
});
export type OrderReserveResponseDTO = z.infer<typeof OrderReserveResponseSchema>;

/**
 * `GET /api/orders/:id/receipt` — §3.7.
 *
 * **Non è un titolo fiscale**, esattamente come il PDF del biglietto
 * (`RF-PAY-12`, `RF-TCK-11`): nessuna numerazione progressiva, nessun sigillo,
 * nessuna dicitura che possa farlo apparire tale. È una delle tre condizioni che
 * reggono il posizionamento fiscale della piattaforma — non è una scelta di
 * copywriting, ed è il motivo per cui questo DTO non ha e non deve avere un
 * campo `number`.
 */
export const OrderReceiptResponseSchema = z.object({
    fileUrl: z.string(),
});
export type OrderReceiptResponseDTO = z.infer<typeof OrderReceiptResponseSchema>;
