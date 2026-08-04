import { z } from "zod";

/**
 * `I18nText` — backend-brief §3.5 / §5.
 *
 * Ogni campo marcato `I18nText` è un `Json` che porta `{ it, en? }`. L'API
 * restituisce sempre l'oggetto intero anche quando la traduzione manca: è il
 * frontend a mostrare l'originale con l'indicazione della lingua (`RF-PUB-10`).
 */
export const I18nTextSchema = z.object({
    it: z.string().min(1),
    en: z.string().optional(),
});

export type I18nText = z.infer<typeof I18nTextSchema>;

/** Variante nullable, per i campi `I18nText?` del §3.6. */
export const I18nTextNullishSchema = I18nTextSchema.nullish();
