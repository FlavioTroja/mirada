import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/api/api-error';

/**
 * Il passo «serve un account» dell'iscrizione (`AS2`): l'account si crea
 * **dentro** il percorso di iscrizione, non prima e non altrove.
 *
 *  - `POST /api/users/register` — pubblico, crea `Contact`, `Person` e `User`
 *    con il ruolo `DANCER` in una sola transazione (§3.7);
 *  - `POST /api/auth/login` — per chi un account ce l'ha già.
 */
@Component({
  selector: 'app-account-step',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="www-panel">
      <h2 class="www-h2">Serve un account</h2>
      <p class="www-lead">
        L’iscrizione è nominativa: il biglietto porta il tuo nome e il QR di accesso arriva sul tuo
        account.
      </p>

      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="tab"
          [class.active]="mode() === 'REGISTER'"
          [attr.aria-selected]="mode() === 'REGISTER'"
          (click)="mode.set('REGISTER')"
        >
          Crea un account
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          [class.active]="mode() === 'LOGIN'"
          [attr.aria-selected]="mode() === 'LOGIN'"
          (click)="mode.set('LOGIN')"
        >
          Ho già un account
        </button>
      </div>

      @if (error(); as e) {
        <div class="www-notice www-notice-error">
          <strong>Non è stato possibile procedere</strong>
          {{ e }}
        </div>
      }

      @if (mode() === 'REGISTER') {
        <form class="grid" (ngSubmit)="doRegister()">
          <div class="www-field">
            <label class="www-label" for="r-name">Nome</label>
            <input id="r-name" class="www-input" name="firstName" [(ngModel)]="firstName" required />
          </div>
          <div class="www-field">
            <label class="www-label" for="r-surname">Cognome</label>
            <input id="r-surname" class="www-input" name="lastName" [(ngModel)]="lastName" required />
          </div>
          <div class="www-field wide">
            <label class="www-label" for="r-email">Email</label>
            <input id="r-email" class="www-input" type="email" name="email" [(ngModel)]="email" required />
          </div>
          <div class="www-field">
            <label class="www-label" for="r-username">Nome utente</label>
            <input id="r-username" class="www-input" name="username" [(ngModel)]="username" required />
          </div>
          <div class="www-field">
            <label class="www-label" for="r-password">Password</label>
            <input
              id="r-password"
              class="www-input"
              type="password"
              name="password"
              [(ngModel)]="password"
              minlength="8"
              required
            />
            <span class="www-hint">Almeno 8 caratteri.</span>
          </div>
          <div class="actions">
            <button type="submit" class="www-btn" [disabled]="busy()">
              {{ busy() ? 'Creazione…' : 'Crea l’account e prosegui' }}
            </button>
          </div>
        </form>
      } @else {
        <form class="grid" (ngSubmit)="doLogin()">
          <div class="www-field wide">
            <label class="www-label" for="l-user">Nome utente o email</label>
            <input id="l-user" class="www-input" name="usernameOrEmail" [(ngModel)]="usernameOrEmail" required />
          </div>
          <div class="www-field wide">
            <label class="www-label" for="l-pass">Password</label>
            <input id="l-pass" class="www-input" type="password" name="loginPassword" [(ngModel)]="loginPassword" required />
          </div>
          <div class="actions">
            <button type="submit" class="www-btn" [disabled]="busy()">
              {{ busy() ? 'Accesso…' : 'Accedi e prosegui' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [
    `
      .tabs {
        display: flex;
        gap: 0.5rem;
        margin: 1rem 0;
      }
      .tab {
        background: transparent;
        border: 1px solid rgba(var(--text-rgb), 0.22);
        color: rgba(var(--text-rgb), 0.8);
        border-radius: 999px;
        padding: 0.35rem 0.9rem;
        font: inherit;
        cursor: pointer;
      }
      .tab.active {
        border-color: rgb(var(--accent-rgb));
        color: rgb(var(--accent-rgb));
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        margin-top: 0.5rem;
      }
      .www-field.wide,
      .actions {
        grid-column: 1 / -1;
      }
      @media (max-width: 560px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AccountStepComponent {
  private readonly auth = inject(AuthService);

  /**
   * **Nessun output «fatto».** L'accesso riuscito cambia `AuthService.user()`, e
   * il cambio di stato distrugge questo componente *prima* che una `emit()`
   * possa partire: la prima stesura lo faceva e il browser rispondeva con
   * `NG0953 — Unexpected emit for destroyed OutputRef`, con il risultato che il
   * passo successivo non veniva mai avvisato. Chi ospita questo componente
   * osserva direttamente il signal dell'autenticazione.
   */
  protected readonly mode = signal<'REGISTER' | 'LOGIN'>('REGISTER');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected firstName = '';
  protected lastName = '';
  protected email = '';
  protected username = '';
  protected password = '';
  protected usernameOrEmail = '';
  protected loginPassword = '';

  protected async doRegister(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.register({
        username: this.username.trim(),
        password: this.password,
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email: this.email.trim(),
      });
    } catch (err) {
      this.error.set(this.describe(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async doLogin(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.usernameOrEmail.trim(), this.loginPassword);
    } catch (err) {
      this.error.set(this.describe(err));
    } finally {
      this.busy.set(false);
    }
  }

  private describe(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.kind === 'validation') {
        const fields = Object.values(err.fieldErrors);
        return fields.length ? fields.join(' · ') : err.message;
      }
      if (err.kind === 'unauthorized') return 'Nome utente o password non corretti.';
      return err.message;
    }
    return 'Errore imprevisto. Riprova.';
  }
}
