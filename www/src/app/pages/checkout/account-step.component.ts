import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
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
 *
 * ── I due esiti che prima mancavano ──────────────────────────────────────────
 *
 * **1. L'indirizzo ha già un account.** Prima il backend rispondeva
 * `400 «Email già in uso»` e questo componente lo mostrava come un errore
 * qualunque, dentro la scheda «Crea un account». Chi ci finiva restava fermo
 * lì: il messaggio diceva cosa era andato storto ma non cosa fare, e la cosa da
 * fare — **accedere** — stava dietro una scheda che nessuno aveva motivo di
 * aprire. Ora il codice `EMAIL_ALREADY_REGISTERED` porta a un riquadro con il
 * tasto che passa all'accesso **con l'indirizzo già scritto**.
 *
 * **2. L'account nasce da confermare.** La registrazione non fa più accedere:
 * l'indirizzo va dimostrato prima, perché su questa piattaforma il biglietto
 * *è* l'email e un indirizzo sbagliato è un QR che non arriva a nessuno. Il
 * passo mostra quindi uno stato d'attesa, con il rinvio a portata di mano —
 * l'email che non arriva è il modo normale in cui questi percorsi si rompono.
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

      @if (!blocked()) {
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
      }

      @if (existingAccount(); as known) {
        <div class="www-notice www-notice-info">
          <strong>Hai già un account su Mirada</strong>
          L’indirizzo <b>{{ known }}</b> è già registrato. Accedi e prosegui con l’iscrizione: i
          dati che hai appena scritto non servono di nuovo.
          <div class="notice-actions">
            <button type="button" class="www-btn" (click)="goToLogin()">Accedi con questo indirizzo</button>
          </div>
        </div>
      } @else if (awaitingConfirmation(); as pending) {
        <div class="www-notice www-notice-info">
          <strong>Controlla la posta</strong>
          Abbiamo mandato un messaggio a <b>{{ pending }}</b> con un tasto per confermare
          l’indirizzo. Il posto si prenota dopo la conferma, quindi nessun conto alla rovescia è
          partito: puoi prenderti il tempo che serve.
          <div class="notice-actions">
            <button type="button" class="www-btn www-btn-secondary" [disabled]="busy()" (click)="resend()">
              {{ busy() ? 'Invio…' : 'Non è arrivata: rimandala' }}
            </button>
            @if (resent()) {
              <span class="resent">Rimandata. Guarda anche nella posta indesiderata.</span>
            }
          </div>
        </div>
      } @else if (undeliverable(); as stuck) {
        <div class="www-notice www-notice-error">
          <strong>L’account è stato creato, ma l’email non è partita</strong>
          Non siamo riusciti a recapitare il messaggio di conferma a <b>{{ stuck }}</b>. L’account
          esiste già, quindi non registrarti di nuovo: riprova a farti mandare il link.
          <div class="notice-actions">
            <button type="button" class="www-btn" [disabled]="busy()" (click)="resend()">
              {{ busy() ? 'Invio…' : 'Rimanda la conferma' }}
            </button>
            @if (resent()) {
              <span class="resent">Rimandata.</span>
            }
          </div>
        </div>
      }

      @if (error(); as e) {
        <div class="www-notice www-notice-error">
          <strong>Non è stato possibile procedere</strong>
          {{ e }}
        </div>
      }

      <!-- I moduli spariscono negli stati bloccanti: lasciarli visibili
           inviterebbe a ricompilarli, e ogni nuovo tentativo su quell'indirizzo
           fallirebbe adesso con «hai già un account». -->
      @if (blocked()) {
        <!-- il riquadro sopra dice già cosa fare -->
      } @else if (mode() === 'REGISTER') {
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
      .notice-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        margin-top: 0.85rem;
      }
      .resent {
        font-size: 0.9rem;
        color: rgba(var(--text-rgb), 0.72);
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

  /** Lo slug dell'evento da cui parte l'iscrizione: viaggia fino all'email di conferma. */
  readonly eventSlug = input<string | null>(null);

  /** Valorizzato con l'indirizzo quando quell'indirizzo ha già un account. */
  protected readonly existingAccount = signal<string | null>(null);
  /** Valorizzato con l'indirizzo quando la conferma è partita e si attende il clic. */
  protected readonly awaitingConfirmation = signal<string | null>(null);
  /** Valorizzato quando l'account è nato ma l'email **non** è partita. */
  protected readonly undeliverable = signal<string | null>(null);
  protected readonly resent = signal(false);

  /**
   * Gli stati in cui i moduli non hanno più senso.
   *
   * Un `computed` e non tre controlli sparsi nel modello: la condizione compare
   * in due punti — schede e moduli — e le due copie sarebbero destinate a
   * divergere alla prima aggiunta.
   */
  protected readonly blocked = computed(
    () => !!this.existingAccount() || !!this.awaitingConfirmation() || !!this.undeliverable(),
  );

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
    this.resent.set(false);
    const email = this.email.trim();
    try {
      const { confirmationSent } = await this.auth.register({
        username: this.username.trim(),
        password: this.password,
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email,
        eventSlug: this.eventSlug(),
      });

      // Si distingue «è partita» da «non è partita» perché la frase da mostrare
      // è opposta: «controlla la posta» a chi non riceverà mai niente è la
      // bugia peggiore che questo passo possa dire.
      if (confirmationSent) this.awaitingConfirmation.set(email);
      else this.undeliverable.set(email);
    } catch (err) {
      // L'email già registrata **non è un errore da mostrare**: è un bivio, e
      // la strada giusta è l'accesso. Il nome utente occupato invece sì — lì
      // l'unica cosa da fare è cambiarlo, e il modulo deve restare aperto.
      if (err instanceof ApiError && err.code === 'EMAIL_ALREADY_REGISTERED') {
        this.existingAccount.set(email);
      } else {
        this.error.set(this.describe(err));
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async doLogin(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.resent.set(false);
    try {
      await this.auth.login(this.usernameOrEmail.trim(), this.loginPassword);
    } catch (err) {
      // Chi prova ad accedere con un account mai confermato ha le credenziali
      // giuste: non gli si dice «password sbagliata», gli si offre il rinvio.
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_CONFIRMED') {
        this.undeliverable.set(this.usernameOrEmail.trim());
      } else {
        this.error.set(this.describe(err));
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Passa all'accesso portandosi dietro l'indirizzo: non lo si fa riscrivere. */
  protected goToLogin(): void {
    this.usernameOrEmail = this.existingAccount() ?? this.email.trim();
    this.existingAccount.set(null);
    this.error.set(null);
    this.mode.set('LOGIN');
  }

  protected async resend(): Promise<void> {
    const target = this.awaitingConfirmation() ?? this.undeliverable();
    if (!target) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.resendConfirmation(target, this.eventSlug());
      this.resent.set(true);
      // Un rinvio riuscito porta nello stato d'attesa anche chi veniva dal
      // fallimento d'invio: da qui in poi la cosa da fare è la stessa.
      this.awaitingConfirmation.set(target);
      this.undeliverable.set(null);
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
