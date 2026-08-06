import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiClient } from '../api/api.client';
import { AuthenticatedUser, RegisterPayload } from '../domain/models';

/**
 * Autenticazione del ballerino (§3.1).
 *
 * - token in `localStorage`, chiave **`Authorization`**, salvato **grezzo**: il
 *   prefisso `Bearer ` lo aggiunge l'interceptor, in memoria;
 * - **nessun refresh token**: un `401` è un logout;
 * - `POST /api/users/register` è pubblico e crea `Contact`, `Person` e `User`
 *   con il ruolo `DANCER` in una sola transazione (§3.7).
 *
 * **SSR.** `localStorage` non esiste sul server. Ogni accesso passa da
 * `isPlatformBrowser`: sul server l'utente è semplicemente anonimo, e le pagine
 * pubbliche — che sono la ragione di questa applicazione — si rendono lo stesso.
 */
const TOKEN_KEY = 'Authorization';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _token = signal<string | null>(this.readToken());
  private readonly _user = signal<AuthenticatedUser | null>(null);

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);
  /** Nome da mostrare in testata: il nome della persona, o lo username. */
  readonly displayName = computed(() => {
    const u = this._user();
    if (!u) return '';
    return u.person?.name ? `${u.person.name} ${u.person.surname ?? ''}`.trim() : u.username;
  });

  private readToken(): string | null {
    if (!this.isBrowser) return null;
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private writeToken(token: string | null): void {
    this._token.set(token);
    if (!this.isBrowser) return;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage non disponibile: la sessione vale finché la pagina resta aperta */
    }
  }

  /** `POST /api/auth/login` → `{ token }` */
  async login(usernameOrEmail: string, password: string): Promise<void> {
    const res = await this.api.post<{ token: string }>('/auth/login', {
      usernameOrEmail,
      password,
    });
    this.writeToken(res.token);
    await this.loadProfile();
  }

  /** `POST /api/users/register` — auto-registrazione, poi login immediato. */
  async register(payload: RegisterPayload): Promise<void> {
    await this.api.post<AuthenticatedUser>('/users/register', payload);
    await this.login(payload.username, payload.password);
  }

  /** `GET /api/auth/profile` — utente popolato, comprensivo di `wsCode`. */
  async loadProfile(): Promise<void> {
    if (!this._token()) return;
    try {
      this._user.set(await this.api.fetch<AuthenticatedUser>('/auth/profile'));
    } catch {
      // Un profilo non leggibile equivale a nessuna sessione: il `401`
      // dell'interceptor ha già ripulito il token.
      this._user.set(null);
    }
  }

  logout(): void {
    this.writeToken(null);
    this._user.set(null);
  }
}
