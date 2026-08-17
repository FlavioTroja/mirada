import { z } from "zod";

/**
 * Conferma dell'indirizzo — il tasto nell'email.
 *
 * Il gettone arriva nel **corpo** e non nella query string, benché il link che
 * l'utente clicca lo porti nell'URL: fra il clic e questa chiamata c'è la pagina
 * del sito, che lo legge e lo rispedisce. Un gettone in query string finisce nei
 * log del server, nei `Referer` verso terzi e nella cronologia del browser —
 * cioè in tre posti in cui una credenziale d'accesso non deve stare.
 */
export const ConfirmEmailRequestSchema = z.object({
    token: z.string().min(1),
});
export type ConfirmEmailRequestDTO = z.infer<typeof ConfirmEmailRequestSchema>;

export const ConfirmEmailResponseSchema = z.object({
    /**
     * Il token di sessione: chi ha appena confermato **è già dentro**. Chiedere
     * di accedere subito dopo aver dimostrato di possedere l'indirizzo sarebbe
     * un secondo controllo sulla stessa cosa.
     */
    token: z.string(),
    /** `false` quando il link era già stato usato: non è un errore, è un secondo clic. */
    justConfirmed: z.boolean(),
    /** Lo slug dell'evento a cui riportare la persona, se l'iscrizione partiva da lì. */
    next: z.string().nullish(),
});
export type ConfirmEmailResponseDTO = z.infer<typeof ConfirmEmailResponseSchema>;

/** Rinvio del link. */
export const ResendConfirmationRequestSchema = z.object({
    email: z.string().email(),
    eventSlug: z.string().max(200).nullish(),
});
export type ResendConfirmationRequestDTO = z.infer<typeof ResendConfirmationRequestSchema>;

/**
 * La risposta al rinvio è **sempre la stessa**, indirizzo esistente o no.
 *
 * Una risposta che distinguesse i due casi trasformerebbe questa rotta in un
 * oracolo: chiunque potrebbe provare una lista di indirizzi e leggere quali
 * hanno un account su Mirada. La lista di chi frequenta le milonghe è un dato
 * personale, non un dettaglio tecnico.
 */
export const ResendConfirmationResponseSchema = z.object({
    ok: z.literal(true),
});
export type ResendConfirmationResponseDTO = z.infer<typeof ResendConfirmationResponseSchema>;
