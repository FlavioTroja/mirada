import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { Log } from "@utils/adapters/log";
import { fetch } from "@utils/adapters/fetch";

/**
 * OpenID Connect — il lato del backend che parla con Authentik.
 *
 * Fa due cose sole: scambia il codice di autorizzazione con i token, e verifica
 * la firma dell'`id_token`. Tutto il resto — chi sei, cosa puoi — resta di
 * mirada (`SsoService`).
 *
 * ── Perché lo scambio del codice avviene QUI e non nel browser ───────────────
 * Il client è `public` con PKCE: la SPA potrebbe benissimo chiamare da sé il
 * token endpoint. Facendolo qui si guadagnano due cose. I token di Authentik
 * non entrano mai nella pagina — l'unica cosa che il browser conserva resta il
 * JWT di mirada, come prima dell'SSO. E non si dipende dalle intestazioni CORS
 * del token endpoint, che sono configurazione di Authentik e potrebbero
 * cambiare sotto di noi.
 *
 * PKCE continua a fare il suo lavoro: il `code_verifier` nasce nel browser e
 * viaggia con il codice, quindi un codice intercettato senza il verificatore
 * non vale nulla.
 */

/** Configurazione, letta una volta sola all'avvio. `null` = SSO spento. */
export interface OidcConfig {
    issuer: string;
    clientId: string;
    scope: string;
}

export function oidcConfig(): OidcConfig | null {
    const issuer = process.env.OIDC_ISSUER;
    const clientId = process.env.OIDC_CLIENT_ID;
    if (!issuer || !clientId) {
        return null;
    }
    return {
        // L'issuer DEVE finire con `/`: Authentik lo dichiara così nel documento
        // di scoperta, e `jose` confronta la stringa esatta. Uno slash mancante
        // fa fallire ogni verifica con un messaggio che parla di issuer non
        // corrispondente e non dice quale dei due sia sbagliato.
        issuer: issuer.endsWith("/") ? issuer : `${issuer}/`,
        clientId,
        scope: process.env.OIDC_SCOPE || "openid profile email",
    };
}

/** Il pezzo del documento di scoperta che ci serve. */
interface Discovery {
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
    end_session_endpoint?: string;
}

let discoveryCache: { at: number; value: Discovery } | null = null;
let jwksCache: { uri: string; value: ReturnType<typeof createRemoteJWKSet> } | null = null;

/** Un'ora: gli endpoint di un fornitore non cambiano quasi mai, ma «quasi». */
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

export async function discovery(config: OidcConfig): Promise<Discovery> {
    const now = Date.now();
    if (discoveryCache && now - discoveryCache.at < DISCOVERY_TTL_MS) {
        return discoveryCache.value;
    }

    const url = `${config.issuer}.well-known/openid-configuration`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`[Oidc Adapter]: discovery document responded ${res.status} (${url})`);
    }
    const value = (await res.json()) as Discovery;

    // ⚠️ Authentik costruisce l'issuer dall'`Host` della richiesta. Interrogato
    // per errore sul loopback restituisce endpoint su `127.0.0.1:9000`, che dal
    // browser non esistono: il sintomo è un accesso che porta su una pagina
    // irraggiungibile, e sembra un guasto di rete. Se OIDC_ISSUER è il nome
    // pubblico, tutto torna — ma vale la pena accorgersene qui.
    if (!value.token_endpoint?.startsWith("http")) {
        throw new Error("[Oidc Adapter]: discovery document has no usable token_endpoint");
    }

    discoveryCache = { at: now, value };
    Log.info(`[Oidc Adapter]: discovery document loaded from ${url}`);
    return value;
}

/**
 * Le chiavi pubbliche del fornitore, con cui si verifica la firma.
 *
 * `createRemoteJWKSet` le scarica alla prima verifica e le tiene in memoria,
 * riscaricandole quando incontra un `kid` che non conosce: è ciò che fa
 * funzionare la **rotazione delle chiavi** senza riavviare il backend.
 */
function jwks(uri: string) {
    if (!jwksCache || jwksCache.uri !== uri) {
        jwksCache = { uri, value: createRemoteJWKSet(new URL(uri)) };
    }
    return jwksCache.value;
}

export interface IdTokenClaims extends JWTPayload {
    sub: string;
    email?: string;
    email_verified?: boolean;
    preferred_username?: string;
    name?: string;
    given_name?: string;
    nonce?: string;
}

/**
 * Scambia il codice di autorizzazione e restituisce le rivendicazioni
 * dell'`id_token`, **dopo** averne verificato la firma.
 *
 * @param nonce se presente, deve corrispondere a quello nel token: è ciò che
 *              lega la risposta alla richiesta partita da questo browser e
 *              impedisce il riuso di un token catturato altrove.
 */
export async function exchangeCode(
    config: OidcConfig,
    params: { code: string; codeVerifier: string; redirectUri: string; nonce?: string },
): Promise<IdTokenClaims> {
    const endpoints = await discovery(config);

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: config.clientId,
        code_verifier: params.codeVerifier,
    });

    const res = await fetch(endpoints.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });

    const payload = (await res.json()) as { id_token?: string; error?: string; error_description?: string };

    if (!res.ok || !payload.id_token) {
        // Il messaggio del fornitore si registra ma NON si rimanda al chiamante:
        // distingue fra «codice già usato», «verificatore sbagliato» e «client
        // sconosciuto», che a chi sta davanti allo schermo non servono e a
        // chiunque altro servirebbero eccome.
        Log.warn(
            `[Oidc Adapter]: code exchange refused (${res.status}): `
            + `${payload.error ?? "?"} — ${payload.error_description ?? "no detail"}`,
        );
        throw new Error("code exchange refused by the identity provider");
    }

    const { payload: claims } = await jwtVerify(payload.id_token, jwks(endpoints.jwks_uri), {
        issuer: config.issuer,
        // `audience` è il controllo che impedisce di presentare qui un token
        // emesso per un'ALTRA applicazione dello stesso Authentik. Senza, un
        // token buono per un'applicazione qualsiasi aprirebbe il backoffice.
        audience: config.clientId,
    });

    const idClaims = claims as IdTokenClaims;

    if (params.nonce && idClaims.nonce !== params.nonce) {
        Log.warn("[Oidc Adapter]: nonce mismatch — id_token rejected");
        throw new Error("nonce mismatch");
    }

    if (!idClaims.sub) {
        throw new Error("id_token has no sub");
    }

    return idClaims;
}

/** L'URL a cui il browser va per accedere: lo compone la SPA, questo lo serve. */
export async function authorizationEndpoint(config: OidcConfig): Promise<string> {
    return (await discovery(config)).authorization_endpoint;
}

/**
 * L'URL con cui si **chiude** la sessione dal lato del fornitore — quello che
 * l'OIDC chiama *RP-Initiated Logout*.
 *
 * ⚠️ Senza questo giro, «Esci» cancella solo il JWT di mirada e la sessione di
 * Authentik resta aperta: il tasto «Accedi» subito dopo non chiede nulla e
 * riporta dentro la stessa persona. Il sintomo che si vede è «non riesco più a
 * uscire», e sembra un guasto della SPA mentre è esattamente ciò che l'SSO deve
 * fare — finché nessuno chiude anche l'altra metà.
 *
 * `null` quando il fornitore non lo dichiara: il frontend in quel caso si limita
 * alla disconnessione locale, che è il comportamento di prima e non peggiora.
 */
export async function endSessionEndpoint(config: OidcConfig): Promise<string | null> {
    return (await discovery(config)).end_session_endpoint ?? null;
}
