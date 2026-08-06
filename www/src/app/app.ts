import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteHeaderComponent } from './layout/site-header.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-site-header />
    <main id="contenuto">
      <router-outlet />
    </main>
    <footer class="site-footer">
      <p>
        <strong>Mirada Tango</strong> — marketplace di eventi di tango argentino.
        Gli importi mostrati comprendono i diritti di prevendita solo dove indicato.
      </p>
      <p class="fine">
        La piattaforma è uno strumento di vendita, non un intermediario fiscale: emette una
        conferma d’ordine con QR di accesso, mai un titolo fiscale.
      </p>
    </footer>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }
      main {
        flex: 1;
        width: 100%;
      }
      .site-footer {
        margin-top: 4rem;
        padding: 2rem 1.25rem 3rem;
        border-top: 1px solid rgba(var(--text-rgb), 0.12);
        color: rgba(var(--text-rgb), 0.62);
        font-size: 0.85rem;
        line-height: 1.6;
      }
      .site-footer p {
        max-width: 76rem;
        margin: 0 auto;
      }
      .site-footer .fine {
        margin-top: 0.5rem;
        opacity: 0.8;
      }
    `,
  ],
})
export class App {}
