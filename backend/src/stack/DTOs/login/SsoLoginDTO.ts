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
