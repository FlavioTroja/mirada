import { z } from "zod";

/**
 * `PATCH /api/registrations/:id/instalments` — **il piano intero**, non una rata
 * per volta (regola 12 di `controllers.md`, come le sessioni di un titolo).
 *
 * ── Perché l'array intero ───────────────────────────────────────────────────
 * Perché `RB35` è un vincolo **sull'insieme**: la somma delle rate dev'essere il
 * dovuto dell'iscrizione. Aggiungere, modificare o togliere una rata per volta
 * significherebbe attraversare stati in cui il piano non torna — e delle due
 * l'una: o si rifiuta ogni passo intermedio, rendendo impossibile riorganizzare
 * un piano, o non si verifica affatto.
 *
 * Mandare tutto insieme rende la verifica possibile una volta sola, sul risultato.
 *
 * ⚠️ **Nessun campo «pagata»**, e non va aggiunto (`RB34`): il piano è una
 * previsione, i versamenti sono i fatti, e il ritardo è il confronto fra i due.
 */
export const PaymentInstalmentRowSchema = z.object({
    /** Centesimi interi, sempre positivi: una rata da zero non è una rata. */
    amount: z.number().int().positive(),
    dueAt: z.coerce.date(),
    note: z.string().trim().max(500).optional(),
});

export const PaymentInstalmentPlanSchema = z.object({
    /**
     * Le rate, nell'ordine in cui vanno onorate. L'ordine dell'array **è**
     * l'ordine: `sortOrder` lo deriva il server, e chiederlo al client
     * significherebbe accettare un piano in cui i due si contraddicono.
     *
     * Un array vuoto **cancella il piano**, ed è legittimo: si torna al residuo
     * aperto senza scadenze, cioè a come funzionava prima.
     */
    instalments: PaymentInstalmentRowSchema.array().max(24),
});

export type PaymentInstalmentPlanDTO = z.infer<typeof PaymentInstalmentPlanSchema>;
