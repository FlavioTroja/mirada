import { z } from "zod";

/**
 * `POST /prospects/mark-contacted` — **dopo** aver scritto a tutti.
 *
 * Il gesto reale è uno: si copiano le email, si manda un messaggio solo, e poi
 * si segnano tutti. Farlo riga per riga su quaranta contatti è il modo sicuro
 * di dimenticarne tre — che l'anno dopo ricevono lo stesso messaggio due volte.
 */
export const ProspectMarkContactedSchema = z.object({
    ids: z.number().int().positive().array().min(1).max(500),
});
export type ProspectMarkContactedDTO = z.infer<typeof ProspectMarkContactedSchema>;
