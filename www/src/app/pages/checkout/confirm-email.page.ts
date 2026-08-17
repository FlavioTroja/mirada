import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/api/api-error';
import { SeoService } from '../../core/seo/seo.service';

/**
 * `/conferma-email?token=…` — **dove atterra il tasto dell'email**.
 *
 * ── Perché una pagina e non un link diretto all'API ──────────────────────────
 * Il tasto potrebbe puntare dritto al backend, che confermerebbe e rimanderebbe
 * indietro con un `302`. Non lo fa, per tre ragioni che si sommano:
 *
 * · **Il gettone finirebbe in posti in cui una credenziale non deve stare.** In
 *   query string viaggia nei log del server, nell'intestazione `Referer` verso
 *   ogni terza parte della pagina d'arrivo e nella cronologia del browser. Qui
 *   la pagina lo legge dall'URL e lo rispedisce nel **corpo** di una POST.
 * · **La sessione va consegnata al browser.** Il token di accesso deve finire
 *   nella memoria del sito; una redirezione dal backend non può scriverla.
 * · **Gli esiti sono più di uno**, e ognuno vuole parole sue: confermato ora,
 *   già confermato, scaduto, non valido. Un `302` sa dire soltanto «vai qui».
 *
 * ── Perché la destinazione arriva firmata dal server ─────────────────────────
 * Dove tornare non si legge dall'URL ma dal campo `next` della risposta, che il
 * backend ricava dal **contenuto firmato** del gettone. Una destinazione presa
 * dalla query string sarebbe riscrivibile da chiunque confezioni il link: un
 * indirizzo che rimbalza dove vuole il mittente è esattamente l'arnese con cui
 * si costruisce una pagina d'accesso falsa.
 */
@Component({
  selector: 'app-confirm-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap">
      <div class="www-panel">
        @switch (state()) {
          @case ('WORKING') {
            <h1 class="www-h1">Un momento…</h1>
            <p class="www-lead">Stiamo confermando il tuo indirizzo.</p>
          }

          @case ('CONFIRMED') {
            <h1 class="www-h1">Indirizzo confermato.</h1>
            <p class="www-lead">
              Sei dentro, e sei già connesso: adesso puoi scegliere il titolo d’ingresso e
              prenotare il posto.
            </p>
            <div class="actions">
              <button type="button" class="www-btn" (click)="go()">{{ ctaLabel() }}</button>
            </div>
          }

          @case ('ALREADY') {
            <h1 class="www-h1">Era già confermato.</h1>
            <p class="www-lead">
              Questo link l’avevi già usato — nessun problema, capita di aprire l’email due volte.
              Sei connesso e puoi proseguire.
            </p>
            <div class="actions">
              <button type="button" class="www-btn" (click)="go()">{{ ctaLabel() }}</button>
            </div>
          }

          @case ('EXPIRED') {
            <h1 class="www-h1">Il link è scaduto.</h1>
            <p class="www-lead">
              Non hai perso nulla: nessun posto era stato prenotato e l’account esiste ancora.
              Scrivi qui il tuo indirizzo e te ne mandiamo uno nuovo.
            </p>
            <form class="resend" (ngSubmit)="resend()">
              <input
                class="www-input"
                type="email"
                name="email"
                placeholder="Il tuo indirizzo email"
                [value]="email()"
                (input)="email.set($any($event.target).value)"
                required
              />
              <button type="submit" class="www-btn" [disabled]="busy()">
                {{ busy() ? 'Invio…' : 'Mandami un nuovo link' }}
              </button>
            </form>
            @if (resent()) {
              <div class="www-notice www-notice-ok">
                <strong>Fatto</strong>
                Se quell’indirizzo ha un account da confermare, il link è in arrivo. Guarda anche
                nella posta indesiderata.
              </div>
            }
          }

          @default {
            <h1 class="www-h1">Questo link non è valido.</h1>
            <p class="www-lead">{{ message() }}</p>
            <div class="actions">
              <button type="button" class="www-btn www-btn-secondary" (click)="go()">
                Vai agli eventi
              </button>
            </div>
          }
        }
      </div>
    </section>
  `,
  styles: [
    `
      .wrap {
        max-width: 640px;
        margin: 0 auto;
        padding: 3rem 1rem;
      }
      .actions {
        margin-top: 1.5rem;
      }
      .resend {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1.25rem;
      }
      .resend .www-input {
        flex: 1 1 16rem;
      }
    `,
  ],
})
export class ConfirmEmailPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly state = signal<'WORKING' | 'CONFIRMED' | 'ALREADY' | 'EXPIRED' | 'INVALID'>(
    'WORKING',
  );
  protected readonly message = signal('');
  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly resent = signal(false);

  /** Lo slug a cui tornare, come lo ha dettato il **gettone firmato**. */
  private readonly next = signal<string | null>(null);

  protected ctaLabel(): string {
    return this.next() ? 'Riprendi l’iscrizione' : 'Vai agli eventi';
  }

  async ngOnInit(): Promise<void> {
    this.seo.apply({
      title: 'Conferma il tuo indirizzo — Mirada',
      description: 'Conferma dell’indirizzo email per l’iscrizione agli eventi.',
      path: '/conferma-email',
      // Una pagina che esiste solo per un gettone monouso non ha niente da
      // offrire a un motore di ricerca, e finirebbe indicizzata con il gettone
      // dentro l'URL.
      noIndex: true,
    });

    // Il gettone si legge dall'URL del browser e non da `ActivatedRoute`
    // perché va **tolto dalla barra** subito dopo: lasciarlo lì lo consegna
    // alla cronologia e a chiunque guardi lo schermo da dietro.
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (!token) {
      this.state.set('INVALID');
      this.message.set('Il link non contiene alcun codice di conferma. Controlla di averlo copiato per intero.');
      return;
    }

    history.replaceState({}, '', location.pathname);

    try {
      const outcome = await this.auth.confirmEmail(token);
      this.next.set(outcome.next);
      this.state.set(outcome.justConfirmed ? 'CONFIRMED' : 'ALREADY');
    } catch (err) {
      // 410 è lo scaduto e ha una via d'uscita — il rinvio. Gli altri no.
      if (err instanceof ApiError && err.status === 410) {
        this.state.set('EXPIRED');
        return;
      }
      this.state.set('INVALID');
      this.message.set(
        err instanceof ApiError
          ? err.message
          : 'Non siamo riusciti a confermare l’indirizzo. Riprova fra qualche minuto.',
      );
    }
  }

  protected async resend(): Promise<void> {
    const address = this.email().trim();
    if (!address) return;
    this.busy.set(true);
    try {
      await this.auth.resendConfirmation(address, this.next());
      this.resent.set(true);
    } catch {
      // La rotta risponde comunque `ok`: un errore qui è di rete, e ripeterlo
      // non aggiunge niente a quello che la persona può fare.
      this.resent.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  protected go(): void {
    const slug = this.next();
    void this.router.navigate(slug ? ['/eventi', slug, 'iscrizione'] : ['/eventi']);
  }
}
