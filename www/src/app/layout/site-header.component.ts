import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/theme/theme.service';
import { MOSTRA_VETRINA_EVENTI } from '../core/flags';
import { AvatarComponent } from '../shared/avatar.component';

/**
 * Testata di `www`. **Nessuna shell keijo, nessuna sidebar**: questa
 * applicazione è anonima e si disegna da zero (§2.2).
 */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="site-header">
      <a class="brand" routerLink="/" aria-label="Mirada Tango — vai alla home">
        <span class="brand-mark" aria-hidden="true">◆</span>
        <span class="brand-name">Mirada <em>Tango</em></span>
      </a>

      <!--
        La voce «Eventi» segue la vetrina — vedi core/flags.ts. Spenta, la testata resta
        con il solo marchio: un menu con una voce che porta a «0 eventi trovati»
        e peggio di un menu che non c'e. La PAGINA continua a esistere e a
        rispondere — si spegne l'insegna, non il negozio.
      -->
      @if (mostraVetrina) {
        <nav class="site-nav" aria-label="Navigazione principale">
          <a routerLink="/eventi" routerLinkActive="active">Eventi</a>
        </nav>
      }

      <div class="site-actions">
        @if (auth.isAuthenticated()) {
          <!--
            Un solo comando, e porta a sé stessi. Tema e uscita stavano qui
            perché non c'era altro posto: ora ce l'hanno, dentro il profilo,
            dove sono impostazioni della persona invece che tasti del sito.
          -->
          <a class="me" routerLink="/profilo" routerLinkActive="active">
            <app-avatar [src]="auth.avatarUrl()" [initials]="auth.initials() || '?'" />
            <span class="who">{{ auth.displayName() || 'Il mio profilo' }}</span>
          </a>
        } @else {
          <!--
            Per chi non è entrato il tema resta qui: è la sola impostazione che
            un visitatore anonimo può cambiare, e non ha un profilo in cui
            andarla a cercare.
          -->
          <button
            type="button"
            class="ghost-btn"
            (click)="theme.toggle()"
            [attr.aria-label]="
              theme.resolved() === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'
            "
          >
            {{ theme.resolved() === 'dark' ? '☾' : '☀' }}
          </button>
          <a class="ghost-btn" routerLink="/accedi">Accedi</a>
        }
      </div>
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
        position: sticky;
        top: 0;
        z-index: 20;
        backdrop-filter: blur(8px);
        background: rgba(var(--background-color), 0.86);
        border-bottom: 1px solid rgba(var(--text-rgb), 0.12);
      }
      .site-header {
        max-width: 76rem;
        margin: 0 auto;
        padding: 0.75rem 1.25rem;
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .brand {
        display: inline-flex;
        align-items: baseline;
        gap: 0.5rem;
        text-decoration: none;
        color: rgb(var(--text-rgb));
        font-size: 1.15rem;
        letter-spacing: 0.02em;
      }
      .brand-mark {
        color: rgb(var(--accent-rgb));
      }
      .brand-name em {
        font-style: normal;
        color: rgb(var(--accent-rgb));
      }
      .site-nav {
        margin-left: 1rem;
        display: flex;
        gap: 1rem;
        flex: 1;
      }
      .site-nav a {
        color: rgba(var(--text-rgb), 0.78);
        text-decoration: none;
        padding: 0.35rem 0;
        border-bottom: 2px solid transparent;
      }
      .site-nav a:hover,
      .site-nav a.active {
        color: rgb(var(--text-rgb));
        border-bottom-color: rgb(var(--accent-rgb));
      }
      .site-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        /* A destra per conto proprio, non perche il menu accanto occupa lo
           spazio. Era il flex:1 di .site-nav a spingerli in fondo, e bastava
           che il menu non ci fosse — nascosto sotto i 640px da sempre, o spento
           con la vetrina — perche i comandi scivolassero accanto al marchio. */
        margin-left: auto;
      }
      .me {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        text-decoration: none;
        color: rgba(var(--text-rgb), 0.86);
        border: 1px solid transparent;
        border-radius: 999px;
        padding: 0.2rem 0.6rem 0.2rem 0.2rem;
      }
      .me:hover,
      .me.active {
        border-color: rgba(var(--accent-rgb), 0.7);
        color: rgb(var(--text-rgb));
      }
      .who {
        color: inherit;
        font-size: 0.9rem;
        max-width: 12rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @media (max-width: 640px) {
        .site-nav {
          display: none;
        }
        .who {
          display: none;
        }
      }
    `,
  ],
})
export class SiteHeaderComponent {
  /** Vedi flags.ts. */
  protected readonly mostraVetrina = MOSTRA_VETRINA_EVENTI;

  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  constructor() {
    // Il token vive in `localStorage` e non esiste sul server: il profilo si
    // legge alla prima resa nel browser, così la testata dice **chi** è entrato
    // invece di un generico «il mio account».
    afterNextRender(() => {
      if (this.auth.isAuthenticated() && !this.auth.user()) void this.auth.loadProfile();
    });
  }
}
