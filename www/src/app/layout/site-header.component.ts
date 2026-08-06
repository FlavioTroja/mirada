import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/theme/theme.service';

/**
 * Testata di `www`. **Nessuna shell keijo, nessuna sidebar**: questa
 * applicazione è anonima e si disegna da zero (§2.2).
 */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="site-header">
      <a class="brand" routerLink="/eventi" aria-label="Mirada Tango — vai alla ricerca eventi">
        <span class="brand-mark" aria-hidden="true">◆</span>
        <span class="brand-name">Mirada <em>Tango</em></span>
      </a>

      <nav class="site-nav" aria-label="Navigazione principale">
        <a routerLink="/eventi" routerLinkActive="active">Eventi</a>
      </nav>

      <div class="site-actions">
        <button
          type="button"
          class="ghost-btn"
          (click)="theme.toggle()"
          [attr.aria-label]="theme.resolved() === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'"
        >
          {{ theme.resolved() === 'dark' ? '☾' : '☀' }}
        </button>

        @if (auth.isAuthenticated()) {
          <span class="who" title="Sei entrato">{{ auth.displayName() || 'Il mio account' }}</span>
          <button type="button" class="ghost-btn" (click)="auth.logout()">Esci</button>
        } @else {
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
      }
      .who {
        color: rgba(var(--text-rgb), 0.72);
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
