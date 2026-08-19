import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api.client';
import { AuthService } from './auth.service';

/**
 * Accesso tramite fornitore di identità (Authentik) — il lato browser.
 *
 * ── Cosa fa questa classe, e cosa NON fa ─────────────────────────────────────
 * Fa **due terzi** di Authorization Code con PKCE: genera il verificatore,
 * manda il browser dal fornitore, e al ritorno consegna il codice al backend.
 * Il terzo passo — scambiare il codice con i token — **non** avviene qui:
 * lo fa il backend (`POST /api/auth/sso`).
 *
 * Non è pigrizia, sono due conseguenze volute. Nessun token di Authentik entra
 * mai nella pagina: l'unica cosa che resta in `localStorage` è il JWT di mirada,
 * esattamente come prima dell'SSO. E non si dipende dalle intestazioni CORS del
 * token endpoint, che sono configurazione di Authentik e possono cambiare senza
 * che questo codice lo sappia.
 *
 * PKCE conserva intatto il suo scopo: il verificatore nasce qui, non lascia mai
 * il browser fino allo scambio, e senza di esso un codice intercettato non vale
 * nulla.
 *
 * ── Perché la configurazione arriva dal backend ──────────────────────────────
 * Issuer e `client_id` si leggono da `GET /api/auth/sso/config`, non da un file
 * compilato dentro il bundle. Così cambiare fornitore, o rinominare
 * l'applicazione su Authentik, non impone di ricostruire e ridistribuire la SPA
 * — e in sviluppo il valore giusto è diverso senza che nessuno debba ricordarlo.
 */

/** Ciò che sopravvive al viaggio dal fornitore: sta in `sessionStorage`, non in `localStorage`. */
const CHIAVE_TRANSITO = 'sso-transito';

interface Transito {
  codeVerifier: string;
  state: string;
  nonce: string;
  /** Dove riportare l'utente dopo l'accesso. */
  redirect: string | null;
}

export type PasswordLoginMode = 'on' | 'god-only' | 'off';

export interface SsoConfig {
  enabled: boolean;
  authorizationEndpoint: string | null;
  clientId: string | null;
  scope: string | null;
  /**
   * Quanto è aperta l'altra porta. Arriva dalla stessa risposta perché la
   * pagina di accesso possa decidere in un colpo solo cosa disegnare, invece
   * di mostrare un form che risponderà 403 a chi ci ha già battuto dentro le
   * proprie credenziali.
   */
  passwordLogin: PasswordLoginMode;
}

@Injectable({ providedIn: 'root' })
export class OidcService {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);

  private readonly _config = signal<SsoConfig | null>(null);
  readonly config = this._config.asReadonly();

  /** L'URI di ritorno. Deve coincidere **carattere per carattere** con quello registrato su Authentik. */
  private get redirectUri(): string {
    return `${location.origin}/auth/callback`;
  }

  /**
   * Chiede al backend se l'SSO è disponibile.
   *
   * Non solleva mai: un fornitore spento o irraggiungibile deve lasciare la
   * pagina di accesso perfettamente funzionante con utente e password.
   */
  async loadConfig(): Promise<SsoConfig> {
    try {
      const config = await this.api.fetch<SsoConfig>('/auth/sso/config');
      this._config.set(config);
      return config;
    } catch {
      // Se la chiamata stessa non riesce, si assume la configurazione più
      // permissiva: form visibile, nessun tasto. È la pagina di accesso di
      // ieri, cioè qualcosa che di sicuro funziona.
      const spento: SsoConfig = {
        enabled: false,
        authorizationEndpoint: null,
        clientId: null,
        scope: null,
        passwordLogin: 'on',
      };
      this._config.set(spento);
      return spento;
    }
  }

  /** Manda il browser dal fornitore. Non ritorna: la pagina viene abbandonata. */
  async start(redirect: string | null): Promise<void> {
    const config = this._config() ?? (await this.loadConfig());
    if (!config.enabled || !config.authorizationEndpoint || !config.clientId) {
      throw new Error('Accesso tramite fornitore di identità non disponibile.');
    }

    const codeVerifier = casuale(64);
    const transito: Transito = {
      codeVerifier,
      state: casuale(16),
      nonce: casuale(16),
      redirect,
    };

    // `sessionStorage` e non `localStorage`: il transito vale per QUESTA scheda
    // e per questo viaggio. In `localStorage` sopravvivrebbe a un accesso
    // abbandonato e resterebbe lì, buono per essere riusato da un secondo
    // tentativo che non gli appartiene.
    sessionStorage.setItem(CHIAVE_TRANSITO, JSON.stringify(transito));

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: config.scope ?? 'openid profile email',
      state: transito.state,
      nonce: transito.nonce,
      code_challenge: await sfida(codeVerifier),
      code_challenge_method: 'S256',
    });

    location.assign(`${config.authorizationEndpoint}?${params.toString()}`);
  }

  /**
   * Il ritorno dal fornitore: consegna il codice al backend e apre la sessione.
   *
   * @returns il percorso su cui riportare l'utente
   */
  async complete(code: string, state: string): Promise<string> {
    const grezzo = sessionStorage.getItem(CHIAVE_TRANSITO);
    // Si consuma SUBITO, prima ancora di sapere se andrà bene: un transito
    // lasciato lì dopo un tentativo fallito è un verificatore riutilizzabile.
    sessionStorage.removeItem(CHIAVE_TRANSITO);

    if (!grezzo) {
      throw new Error("La richiesta di accesso non risulta partita da questa scheda del browser.");
    }

    const transito = JSON.parse(grezzo) as Transito;

    // Lo `state` è ciò che lega la risposta alla richiesta: senza questo
    // confronto, un collegamento costruito da altri potrebbe far completare un
    // accesso che l'utente non ha mai iniziato.
    if (state !== transito.state) {
      throw new Error('La risposta del fornitore di identità non corrisponde alla richiesta.');
    }

    const res = await this.api.post<{ token: string }>('/auth/sso', {
      code,
      codeVerifier: transito.codeVerifier,
      redirectUri: this.redirectUri,
      nonce: transito.nonce,
    });

    this.auth.setToken(res.token);
    await this.auth.loadProfile();

    return transito.redirect || '/';
  }
}

/** Stringa casuale sicura, in base64url: serve da verificatore, `state` e `nonce`. */
function casuale(byte: number): string {
  const buf = new Uint8Array(byte);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

/** `code_challenge` = base64url( SHA-256( verificatore ) ). */
async function sfida(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64url(new Uint8Array(digest));
}

/**
 * base64 **url-safe e senza riempimento**, come vuole PKCE.
 *
 * Il base64 normale non va: `+`, `/` e `=` in un parametro di query verrebbero
 * riscritti lungo il tragitto, e il confronto del verificatore fallirebbe con
 * un errore che parla d'altro.
 */
function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
