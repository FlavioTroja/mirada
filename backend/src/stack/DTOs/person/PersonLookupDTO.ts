import { z } from "zod";

/**
 * `GET /api/persons/lookup` — `16-anagrafica-unica.md` §5.
 *
 * ── Il primo presidio è questo schema, non un controllo altrove ──────────────
 * Si cerca per **indirizzo esatto**, e `z.string().email()` è ciò che lo rende
 * vero: non c'è modo di passare un frammento, un prefisso o un carattere jolly.
 * Senza questo vincolo la rotta sarebbe un oracolo che enumera chi sta sulla
 * piattaforma e a che livello balla — e lo sarebbe per chiunque sappia scrivere
 * un ciclo.
 *
 * Chi cerca deve **già sapere** l'indirizzo di chi sta iscrivendo. È il caso
 * d'uso vero: la persona è lì che detta la propria email alla segreteria.
 */
export const PersonLookupSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
});
export type PersonLookupDTO = z.infer<typeof PersonLookupSchema>;

/**
 * Ciò che l'organizzazione vede di una persona censita da altri (decisione A7).
 *
 * ── Cosa c'è, e perché ───────────────────────────────────────────────────────
 * L'anagrafica di base evita il doppio censimento, che è lo scopo. Il profilo di
 * ballo — ruolo preferito, livello, città — c'è perché sono i tre campi che
 * alimentano le quote di ruolo di `05`: precompilarli riduce l'errore proprio
 * dove costa, cioè in una classe o in un evento che si sbilancia.
 *
 * ── Cosa NON c'è, ed è la parte importante ───────────────────────────────────
 * **Nessuno storico.** A quali eventi questa persona abbia partecipato altrove
 * non compare, e non deve: darebbe a un organizzatore la vista sui partecipanti
 * dei suoi concorrenti, ed è l'unico punto in cui questo documento avrebbe
 * davvero incrinato l'isolamento di `backend-brief` §1.5 (decisione A8).
 *
 * Nemmeno il nickname, le lingue, la data di nascita o l'immagine: sono dati che
 * la persona ha messo nel proprio profilo pubblico di ballerino, non in un
 * modulo d'iscrizione.
 */
export const PersonLookupResultSchema = z.object({
    found: z.boolean(),
    personId: z.number().int().nullable(),
    name: z.string().nullable(),
    surname: z.string().nullable(),
    email: z.string().nullable(),
    /** Se ha un'utenza. L'organizzatore lo usa per sapere se riceverà il biglietto in area personale. */
    hasAccount: z.boolean(),
    /**
     * Nullo per tre ragioni diverse e indistinguibili dall'esterno, ed è voluto:
     * la persona non ha un profilo di ballo, **oppure** lo ha nascosto
     * (`DancerProfile.profileVisibleToOrganizers`, decisione A10), **oppure** non
     * esiste affatto. Distinguerle direbbe a chi cerca qualcosa che non gli
     * spetta — «esiste ma non te lo dico» è comunque un'informazione.
     */
    dancerProfile: z.object({
        preferredRole: z.string().nullable(),
        declaredLevel: z.string().nullable(),
        city: z.string().nullable(),
    }).nullable(),
});
export type PersonLookupResultDTO = z.infer<typeof PersonLookupResultSchema>;
