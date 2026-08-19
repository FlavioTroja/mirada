import { z } from "zod";

/**
 * Corpo di `POST /auth/sso` — il ritorno dal fornitore di identità.
 *
 * Arriva il **codice di autorizzazione**, non un token: lo scambio con Authentik
 * lo fa il backend (`@utils/adapters/oidc`), così nessun token del fornitore
 * entra mai nel browser.
 */
export const SsoLoginSchema = z.object({
    /** Il `code` che Authentik ha rimandato all'URI di reindirizzamento. */
    code: z.string().min(1),
    /**
     * Il verificatore PKCE nato nel browser insieme alla richiesta. È ciò che
     * lega il codice a QUESTO client: un codice intercettato senza il
     * verificatore non è scambiabile.
     */
    codeVerifier: z.string().min(1),
    /**
     * Deve essere identico a quello usato nella richiesta di autorizzazione:
     * Authentik lo riconfronta, e una differenza anche solo di slash finale fa
     * fallire lo scambio.
     */
    redirectUri: z.string().url(),
    /** Lega la risposta alla richiesta partita da questo browser. */
    nonce: z.string().min(1).optional(),
    /**
     * Il gettone dell'invito, se la persona è arrivata da un link d'invito.
     *
     * Serve **già qui**, e non solo alla conferma: sapendolo, la risposta può
     * dire «stai per unirti a Tango Club Bari» invece di proporre l'apertura di
     * un'organizzazione che quella persona non voleva aprire.
     */
    invito: z.string().min(1).optional(),
});

export type SsoLoginDTO = z.infer<typeof SsoLoginSchema>;

/**
 * Risposta di `GET /auth/sso/config` — quel poco che serve alla SPA per
 * comporre la richiesta di autorizzazione.
 *
 * Sta sul backend e non nel build del frontend di proposito: cambiare fornitore
 * o rinominare l'applicazione non deve richiedere di ricostruire e ridistribuire
 * la SPA, e in sviluppo il valore giusto è diverso senza che nessuno ci pensi.
 */
export const SsoConfigSchema = z.object({
    /** `false` quando OIDC_ISSUER/OIDC_CLIENT_ID non sono configurati: il tasto non si mostra. */
    enabled: z.boolean(),
    authorizationEndpoint: z.string().nullable(),
    clientId: z.string().nullable(),
    scope: z.string().nullable(),
    /**
     * Quanto è aperta l'ALTRA porta — l'accesso con utente e password
     * (`PASSWORD_LOGIN` nel `.env` del backend).
     *
     * Sta qui, e non in una rotta sua, perché la pagina di accesso ha bisogno
     * di **una sola risposta** per sapere cosa disegnare: due chiamate
     * significherebbero due momenti in cui la pagina è disegnata a metà.
     *
     * Serve perché senza, chiudere la porta lascerebbe in pagina un form che
     * sembra funzionare e restituisce 403 solo dopo che qualcuno ci ha battuto
     * dentro le proprie credenziali.
     */
    passwordLogin: z.enum(["on", "god-only", "off"]),
});

export type SsoConfigDTO = z.infer<typeof SsoConfigSchema>;

/**
 * Corpo di `POST /auth/sso/signup` — la registrazione vera e propria.
 *
 * ⚠️ **`invito` e `organizzazione` si escludono a vicenda**, e il rifiuto è
 * scritto nello schema invece che nel servizio: è la regola su cui poggia tutta
 * l'autoregistrazione — *è il gettone dell'invito a decidere se nasce un tenant*
 * — e una regola del genere non va lasciata a un `if` che qualcuno, un giorno,
 * riscriverà.
 */
export const SsoSignupSchema = z
    .object({
        /** Il biglietto ricevuto da `POST /auth/sso`: porta l'identità già verificata. */
        ticket: z.string().min(1),
        invito: z.string().min(1).optional(),
        organizzazione: z
            .object({
                nome: z.string().trim().min(2, "Serve il nome dell'organizzazione."),
                /**
                 * Facoltativa: in assenza si usa l'indirizzo con cui la persona
                 * si è autenticata. Chiedere due volte lo stesso indirizzo al
                 * primo passo è attrito senza contropartita.
                 */
                emailContatto: z.string().email().optional(),
            })
            .optional(),
    })
    .refine(dto => !!dto.invito !== !!dto.organizzazione, {
        message: "Serve o il gettone di un invito, o i dati della nuova organizzazione — non entrambi.",
    });

export type SsoSignupDTO = z.infer<typeof SsoSignupSchema>;

/** Risposta di `POST /auth/sso`: sessione aperta, oppure registrazione da fare. */
export const SsoLoginResponseSchema = z.object({
    esito: z.enum(["sessione", "registrazione"]),
    /** Valorizzato solo con `esito: "sessione"`. */
    token: z.string().nullable(),
    /** Valorizzati solo con `esito: "registrazione"`. */
    ticket: z.string().nullable(),
    email: z.string().nullable(),
    nome: z.string().nullable(),
    invito: z
        .object({
            organizationId: z.number().int(),
            organizzazione: z.string(),
            ruolo: z.string(),
        })
        .nullable(),
});

export type SsoLoginResponseDTO = z.infer<typeof SsoLoginResponseSchema>;
