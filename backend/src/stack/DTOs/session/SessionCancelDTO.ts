import { z } from "zod";

/**
 * Corpo di `POST /api/sessions/:id/cancel` (§3.7, `RF-EVT-35`).
 *
 * La motivazione è obbligatoria: l'annullamento di una sessione va comunicato ai
 * soli titolari dei titoli che la includono, e senza una causale la
 * comunicazione non è scrivibile.
 */
export const SessionCancelSchema = z.object({
    reason: z.string().min(1, "La motivazione dell'annullamento è obbligatoria."),
});
export type SessionCancelDTO = z.infer<typeof SessionCancelSchema>;
