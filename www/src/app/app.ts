import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SiteHeaderComponent } from './layout/site-header.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, SiteHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-site-header />
    <main id="contenuto">
      <router-outlet />
    </main>
    <!-- Il piede di slesh.it: un invito al centro, poi le colonne. Prugna in
         entrambi i temi, con la fascia di shared/mirada-theme.scss. -->
    <footer class="site-footer mirada-band">
      <div class="invito">
        <h2>Organizzi tango argentino?</h2>
        <p>Costruisci il tuo festival, marathon o encuentro, e apri le iscrizioni.</p>
        <a class="www-btn" href="https://app.mirada.dance">Apri la tua organizzazione</a>
      </div>

      <div class="colonne">
        <div class="col col-marchio">
          <p class="marchio"><span aria-hidden="true">◆</span> Mirada <em>Tango</em></p>
          <p>Marketplace di eventi di tango argentino.</p>
        </div>
        <nav class="col" aria-label="Il sito">
          <p class="col-titolo">Il sito</p>
          <a routerLink="/">Home</a>
          <a routerLink="/accedi">Accedi</a>
        </nav>
        <nav class="col" aria-label="Per chi organizza">
          <p class="col-titolo">Per chi organizza</p>
          <a href="https://app.mirada.dance">Il back-office</a>
        </nav>
        <div class="col col-note">
          <p class="col-titolo">Note</p>
          <p>
            Gli importi mostrati comprendono i diritti di prevendita solo dove indicato.
          </p>
          <p>
            La piattaforma è uno strumento di vendita, non un intermediario fiscale: emette una
            conferma d’ordine con QR di accesso, mai un titolo fiscale.
          </p>
        </div>
      </div>
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
        font-size: 0.875rem;
        line-height: 1.6;
      }
      .invito {
        max-width: 44rem;
        margin: 0 auto;
        padding: 4.5rem 1.25rem 3.5rem;
        text-align: center;
      }
      .invito h2 {
        margin: 0;
        font-size: clamp(1.5rem, 1.1rem + 1.6vw, 2.2rem);
        line-height: 1.2;
      }
      .invito p {
        margin: 0.75rem 0 1.5rem;
        color: rgba(var(--text-rgb), 0.78); /* 12:1 */
      }
      /* Le colonne stanno su un prugna appena piu chiaro, come il piede di
         slesh.it sotto l'invito. */
      .colonne {
        background: rgba(255, 255, 255, 0.04);
        display: grid;
        grid-template-columns: 1.3fr 1fr 1fr 2fr;
        gap: 2rem;
        padding: 2.5rem max(1.25rem, calc((100% - var(--www-max)) / 2 + 1.25rem)) 3rem;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        color: rgba(var(--text-rgb), 0.72); /* 10:1 */
      }
      .col p {
        margin: 0;
      }
      .col a {
        color: rgba(var(--text-rgb), 0.86);
        text-decoration: none;
      }
      .col a:hover {
        color: rgb(var(--accent-rgb));
      }
      .col-titolo {
        color: rgb(var(--text-rgb));
        font-weight: 600;
        margin-bottom: 0.3rem !important;
      }
      .marchio {
        color: rgb(var(--text-rgb));
        font-size: 1.1rem;
        font-weight: 700;
      }
      .marchio span,
      .marchio em {
        color: rgb(var(--accent-rgb));
        font-style: normal;
      }
      @media (max-width: 760px) {
        .colonne {
          grid-template-columns: 1fr 1fr;
        }
        .col-marchio,
        .col-note {
          grid-column: 1 / -1;
        }
      }
    `,
  ],
})
export class App {}
