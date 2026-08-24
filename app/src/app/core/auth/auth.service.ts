import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api.client';
import { AppRole, Capabilities, capabilitiesOf, toAppRole } from './roles';

/**
 * Token in `localStorage`, chiave **`Authorization`**, valore **grezzo**:
 * il prefisso `Bearer ` lo aggiunge l'interceptor in memoria (§3.1, §5).
 */
export const TOKEN_STORAGE_KEY = 'Authorization';

/**
 * Come è nata questa sessione: presente = si è passati dal fornitore.
 *
 * Serve a una cosa sola, e non è cosmetica: «Esci» deve mandare il browser a
 * chiudere la sessione su Authentik **solo** se ce n'è una da chiudere. Chi è
 * entrato con utente e password non ha alcuna sessione dal fornitore, e
 * spedirlo all'`end_session_endpoint` lo farebbe atterrare sulla schermata di
 * accesso di Authentik — l'esatto contrario di uscire.
 *
 * Sta accanto al token e viene cancellata insieme a lui: due chiavi che possono
 * divergere sarebbero peggio di una sola sbagliata.
 */
const SSO_STORAGE_KEY = 'sso-sessione';

export interface ProfileRole {
  roleName: string;
  isActive: boolean;
}

export interface UserProfile {
  id: number;
  username: string;
  /** Codice del canale WebSocket keijo (§3.9). */
  wsCode?: string | null;
  avatarUrl?: string | null;
  roles?: ProfileRole[];
  person?: {
    name?: string | null;
    surname?: string | null;
    contact?: { email?: string | null } | null;
  } | null;
}

/**
 * Stato di autenticazione a **signals** — pattern di stato del progetto
 * (`AGENTS.md`, `KEIJO-STATE-CONSISTENCY-WITH-AGENTS-MD`).
 *
 * Nessun refresh token: un `401` significa logout (§3.1).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);

  private readonly _token = signal<string | null>(readStoredToken());
  private readonly _viaSso = signal(readStoredSsoFlag());
  private readonly _profile = signal<UserProfile | null>(null);
  private readonly _loading = signal(false);

  readonly token = this._token.asReadonly();
  /** `true` se la sessione corrente è nata dal fornitore di identità. */
  readonly viaSso = this._viaSso.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly isAuthenticated = computed(() => this._token() !== null);

  /** Ruoli attivi del §3.8; `ADMIN`/`USER` del template non concedono nulla. */
  readonly roles = computed<AppRole[]>(() => {
    const profile = this._profile();
    if (!profile?.roles) return [];
    return profile.roles
      .filter((r) => r.isActive)
      .map((r) => toAppRole(r.roleName))
      .filter((r): r is AppRole => r !== null);
  });

  readonly can = computed<Capabilities>(() => capabilitiesOf(this.roles()));

  readonly displayName = computed(() => {
    const profile = this._profile();
    if (!profile) return 'Utente';
    const person = profile.person;
    const full = [person?.name, person?.surname].filter(Boolean).join(' ').trim();
    return full || profile.username;
  });

  readonly wsCode = computed(() => this._profile()?.wsCode ?? null);

  /** `POST /api/auth/login` body `{ usernameOrEmail, password }` → `{ token }`. */
  async login(usernameOrEmail: string, password: string): Promise<void> {
    this._loading.set(true);
    try {
      const res = await this.api.post<{ token: string }>('/auth/login', {
        usernameOrEmail,
        password,
      });
      this.setToken(res.token);
      await this.loadProfile();
    } finally {
      this._loading.set(false);
    }
  }

  /** `GET /api/auth/profile` → utente popolato, comprensivo di `wsCode`. */
  async loadProfile(): Promise<UserProfile | null> {
    if (!this._token()) return null;
    const profile = await this.api.fetch<UserProfile>('/auth/profile');
    this._profile.set(profile);
    return profile;
  }

  /** Ripristina la sessione all'avvio; su token non più valido esegue il logout. */
  async restore(): Promise<void> {
    if (!this._token()) return;
    try {
      await this.loadProfile();
    } catch {
      this.logout();
    }
  }

  /**
   * @param viaSso se la sessione nasce dal fornitore di identità. Lo passa
   *        `OidcService`; l'accesso con password lascia il valore predefinito,
   *        così un secondo accesso con password non eredita la marcatura del
   *        primo fatto in SSO.
   */
  setToken(token: string, viaSso = false): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    if (viaSso) {
      localStorage.setItem(SSO_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(SSO_STORAGE_KEY);
    }
    this._token.set(token);
    this._viaSso.set(viaSso);
  }

  /**
   * Cancella il token e il profilo. Nessun refresh token da revocare (§3.1).
   *
   * ⚠️ **Locale, e solo locale.** La sessione sul fornitore non viene toccata:
   * ci pensa `OidcService.esci()`, e la separazione è voluta perché questo
   * metodo lo chiamano anche l'interceptor su `401` e `OidcService.start()`
   * prima di partire — due casi in cui portare il browser fuori dall'app
   * significherebbe, nell'ordine, un ciclo di redirect e un accesso annullato
   * a metà.
   */
  logout(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(SSO_STORAGE_KEY);
    this._token.set(null);
    this._viaSso.set(false);
    this._profile.set(null);
  }
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readStoredSsoFlag(): boolean {
  try {
    return localStorage.getItem(SSO_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
