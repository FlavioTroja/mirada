import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@keijo/ui';
import { login as loginIcon, shield } from '@keijo/ui/icons';
import { AuthService } from '../../core/auth/auth.service';
import { OidcService } from '../../core/auth/oidc.service';
import { landingFor } from '../../shell/sidebar-routes';

/**
 * `/` — la pagina che vede chi arriva su `app.mirada.dance` senza sessione.
 *
 * Prima qui c'era un modulo d'accesso con tre righe di spiegazione. Non era il
 * posto giusto per spiegare: un modulo si compila, non si legge — e chi non sa
 * ancora cosa sia Mirada non arriva a compilarlo. Questa pagina racconta il
 * prodotto a chi organizza; l'accesso è un tasto in alto a destra.
 *
 * ⚠️ Il tasto **non** porta a `https://auth.mirada.dance/`, anche se è lì che
 * si finisce. Porta all'AUTORIZZAZIONE OIDC, che mostra quella stessa schermata
 * e poi **riporta indietro**. Puntare alla radice di Authentik lascerebbe chi
 * accede sul cruscotto di Authentik, autenticato e fuori da Mirada — con
 * l'impressione che l'accesso non abbia funzionato.
 *
 * Chi ha già una sessione non la vede: viene portato dove il suo ruolo atterra.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <div class="home">
      <header class="topbar">
        <div class="brand">
          <span class="rombo" aria-hidden="true"></span>
          <span class="brand-name">Mirada<span class="brand-gold">Tango</span></span>
        </div>
        <keijo-button
          [icon]="loginIcon"
          label="Accedi"
          variant="accent"
          [loading]="working()"
          (action)="accedi()"
        />
      </header>

      @if (failure(); as msg) {
        <p class="errore">{{ msg }}</p>
      }

      <section class="hero">
        <p class="occhiello">Per chi organizza tango argentino</p>
        <h1>Dal primo annuncio all’ultimo ballo.</h1>
        <p class="lead">
          Mirada è il posto dove costruisci il tuo festival, marathon o encuentro, raccogli le
          iscrizioni e tieni i conti. Il tuo evento finisce su un sito pubblico fatto per essere
          trovato e condiviso, e tu resti padrone dei tuoi dati e dei tuoi incassi.
        </p>
        <div class="hero-azioni">
          <keijo-button
            [icon]="ssoIcon"
            label="Apri la tua organizzazione"
            variant="accent"
            [loading]="working()"
            (action)="accedi()"
          />
          <a class="link-esterno" href="https://mirada.dance" target="_blank" rel="noopener">
            Guarda il sito pubblico
          </a>
        </div>
      </section>

      <section class="griglia">
        <article>
          <h2>Costruisci l’evento</h2>
          <p>
            Sessioni, cast, titoli d’ingresso con scaglioni di prezzo, requisiti da soddisfare e
            servizi accessori. Ogni pezzo sta dove ti aspetti, e l’evento resta in bozza finché
            non decidi tu.
          </p>
        </article>
        <article>
          <h2>Capienza e ruoli di ballo</h2>
          <p>
            Le quote si impostano per evento e per singola sessione, e separatamente per leader e
            follower: la sala non si sbilancia da sola, e chi resta fuori lo sa prima di pagare.
          </p>
        </article>
        <article>
          <h2>Iscritti, coppie, requisiti</h2>
          <p>
            Chi si è iscritto, a cosa e con chi. Le coppie restano legate, i requisiti che
            richiedono una verifica si approvano uno per uno.
          </p>
        </article>
        <article>
          <h2>Incassi e rimborsi</h2>
          <p>
            Il conto d’incasso della tua organizzazione, e policy di rimborso a scaglioni: quanto
            si restituisce a sessanta, trenta o dieci giorni lo decidi una volta e vale per tutti.
          </p>
        </article>
        <article>
          <h2>Report ed esportazioni</h2>
          <p>
            Il riepilogo di come sta andando, e i file da scaricare quando ti servono altrove —
            per il commercialista, per la SIAE, per la porta.
          </p>
        </article>
        <article>
          <h2>La tua squadra</h2>
          <p>
            Invita altri titolari, assegna responsabili eventi e operatori di check-in. Ogni ruolo
            vede soltanto ciò che gli serve: chi sta alla porta non vede gli incassi.
          </p>
        </article>
      </section>

      <section class="passi">
        <h2>Come si comincia</h2>
        <ol>
          <li>
            <strong>Accedi</strong> con Google o con un indirizzo email: l’account te lo crei
            strada facendo.
          </li>
          <li>
            <strong>Apri la tua organizzazione.</strong> Ti serve solo il nome — ragione sociale e
            partita IVA te le chiediamo prima di vendere, non prima di provare.
          </li>
          <li>
            <strong>Costruisci il primo evento.</strong> Puoi lavorarci subito; la vendita si apre
            quando la piattaforma ha approvato l’organizzazione.
          </li>
        </ol>
      </section>

      <footer class="piede">
        <span>Mirada Tango</span>
        <a href="https://mirada.dance" target="_blank" rel="noopener">mirada.dance</a>
      </footer>
    </div>
  `,
  styles: [
    `
      .home {
        position: relative;
        z-index: 1;
        max-width: 68rem;
        margin: 0 auto;
        padding: 1.25rem 1.25rem 4rem;
        color: rgb(var(--text-rgb));
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.5rem 0 2.5rem;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 1.15rem;
        font-weight: 700;
      }
      .rombo {
        width: 0.85rem;
        height: 0.85rem;
        background: rgb(var(--accent-rgb));
        transform: rotate(45deg);
        flex: none;
      }
      .brand-gold {
        color: rgb(var(--accent-rgb));
        margin-left: 0.35rem;
      }

      .errore {
        margin: 0 0 1rem;
        color: rgb(var(--color-error, 255, 138, 128));
      }

      .hero {
        padding: 1rem 0 3.5rem;
        max-width: 44rem;
      }
      .occhiello {
        margin: 0;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgb(var(--accent-rgb));
      }
      .hero h1 {
        margin: 0.5rem 0 0;
        font-size: clamp(2rem, 5vw, 3.25rem);
        line-height: 1.1;
        letter-spacing: -0.02em;
      }
      .lead {
        margin: 1.1rem 0 0;
        font-size: 1.05rem;
        line-height: 1.75;
        color: rgba(var(--text-rgb), 0.82);
      }
      .hero-azioni {
        margin-top: 1.75rem;
        display: flex;
        align-items: center;
        gap: 1.25rem;
        flex-wrap: wrap;
      }
      .link-esterno {
        color: rgb(var(--accent-rgb));
        text-decoration: none;
        border-bottom: 1px solid rgba(var(--accent-rgb), 0.4);
        padding-bottom: 2px;
      }

      /* auto-fit e non auto-fill: su schermi larghi auto-fill creerebbe colonne
         vuote che si prendono lo spazio, e le schede resterebbero strette. */
      .griglia {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
      }
      .griglia article {
        background: rgba(var(--text-rgb), 0.04);
        border: 1px solid rgba(var(--text-rgb), 0.1);
        border-radius: 14px;
        padding: 1.25rem 1.35rem;
      }
      .griglia h2 {
        margin: 0 0 0.5rem;
        font-size: 1.05rem;
      }
      .griglia p {
        margin: 0;
        line-height: 1.7;
        color: rgba(var(--text-rgb), 0.78);
        font-size: 0.94rem;
      }

      .passi {
        margin-top: 3.5rem;
        max-width: 44rem;
      }
      .passi h2 {
        margin: 0 0 1rem;
        font-size: 1.3rem;
      }
      .passi ol {
        margin: 0;
        /* Il reset di Tailwind toglie i marcatori a ogni lista: senza questa
           riga i tre passi perdono i numeri e diventano tre frasi sciolte —
           che è proprio ciò che una sequenza non deve sembrare. */
        list-style: decimal;
        padding-left: 1.4rem;
        display: grid;
        gap: 0.85rem;
        line-height: 1.7;
        color: rgba(var(--text-rgb), 0.82);
      }
      .passi strong {
        color: rgb(var(--text-rgb));
      }

      .piede {
        margin-top: 4rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(var(--text-rgb), 0.1);
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        font-size: 0.85rem;
        color: rgba(var(--text-rgb), 0.55);
      }
      .piede a {
        color: rgba(var(--text-rgb), 0.55);
        text-decoration: none;
      }

      @media (max-width: 640px) {
        .topbar {
          padding-bottom: 1.75rem;
        }
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly oidc = inject(OidcService);
  private readonly router = inject(Router);

  readonly loginIcon = loginIcon;
  readonly ssoIcon = shield;
  readonly failure = signal<string | null>(null);
  readonly working = signal(false);

  async ngOnInit(): Promise<void> {
    if (this.auth.isAuthenticated()) {
      await this.router.navigateByUrl(landingFor(this.auth.can()));
      return;
    }
    void this.oidc.loadConfig();
  }

  async accedi(): Promise<void> {
    this.failure.set(null);
    this.working.set(true);
    try {
      // Non ritorna: la pagina viene abbandonata per andare dal fornitore.
      await this.oidc.start('/');
    } catch (err) {
      this.working.set(false);
      this.failure.set(
        (err as Error).message ||
          'Accesso non disponibile in questo momento. Riprova fra poco.',
      );
    }
  }
}
