import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';
import { MOSTRA_VETRINA_EVENTI } from '../../core/flags';
import { TangheroAppComponent } from './tanghero-app.component';

/**
 * `mirada.dance/` — la home.
 *
 * Racconta che cos'e il progetto, e poi che cosa arrivera. Non e la ricerca
 * eventi: quella vive a `/eventi` ed e un'altra pagina, con un altro mestiere.
 *
 * ── Perche non e piu un rinvio a `/eventi` ──────────────────────────────────
 * Lo era, e per un catalogo pieno sarebbe la scelta giusta: chi arriva sul sito
 * di una biglietteria vuole i biglietti. Con il catalogo ancora da riempire, la
 * prima cosa che il visitatore vedeva era la prova che non c'e niente da
 * comprare. Una home che spiega il progetto dice invece la cosa vera: la
 * piattaforma esiste, gli eventi arrivano.
 *
 * ── Resa dal server ─────────────────────────────────────────────────────────
 * Cade sotto il `**` di `app.routes.server.ts`, quindi `RenderMode.Server`. E
 * cio che serve: e la pagina il cui indirizzo viene condiviso piu di ogni altro,
 * e nessuno dei crawler che contano esegue JavaScript.
 */
@Component({
  selector: 'app-home',
  imports: [TangheroAppComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="www-wrap hero-wrap">
      <header class="hero">
        <p class="eyebrow">Eventi di tango argentino</p>
        <h1 class="www-h1">
          Chi organizza vende.<br />
          Chi balla trova.
        </h1>
        <p class="www-lead hero-lead">
          Mirada Tango &egrave; la piattaforma su cui un organizzatore costruisce il proprio
          festival, marathon o encuentro e ne vende i titoli d&rsquo;ingresso &mdash; e su cui chi
          balla li trova, si iscrive e si presenta all&rsquo;ingresso con un codice sul telefono.
        </p>

        @if (mostraVetrina) {
          <p class="hero-cta">
            <a class="www-btn" routerLink="/eventi">Guarda gli eventi</a>
          </p>
        }
      </header>

      <!-- I due lati della piattaforma. Sono due mestieri diversi e vanno detti
           separati: un organizzatore e un ballerino non cercano la stessa cosa,
           e un testo solo per entrambi non parla a nessuno dei due. -->
      <div class="sides">
        <section class="side">
          <h2 class="www-h2">Per chi organizza</h2>
          <p>
            Titoli d&rsquo;ingresso, quote per ruolo e per sessione, iscrizioni a coppia, scaglioni
            di prezzo. La capienza &egrave; governata dal sistema: non si vende un posto che non
            c&rsquo;&egrave;, e l&rsquo;equilibrio fra leader e follower smette di essere un foglio
            di calcolo.
          </p>
          <p>
            All&rsquo;ingresso, il check-in funziona <strong>anche senza rete</strong>: il codice si
            verifica sul dispositivo, e la coda non dipende dal wi-fi della sala.
          </p>
          <p class="www-hint">
            Il tuo negozio ce l&rsquo;hai gi&agrave;? Le vendite fatte altrove entrano qui da sole, e
            i biglietti li emette Mirada.
          </p>
        </section>

        <section class="side">
          <h2 class="www-h2">Per chi balla</h2>
          <p>
            Cerchi per citt&agrave;, periodo e <strong>ruolo di ballo</strong> &mdash; perch&eacute;
            un evento esaurito per i leader pu&ograve; avere ancora posto per i follower, e sapere
            quale dei due sei cambia la risposta.
          </p>
          <p>
            Ti iscrivi, paghi, e il biglietto arriva per email con il suo codice. Se poi non puoi
            andare, il nominativo si trasferisce: il posto non si perde.
          </p>
          <p class="www-hint">
            Nessun account obbligatorio per guardare. Serve quando compri, perch&eacute; il
            biglietto &egrave; tuo e deve poterti seguire.
          </p>
        </section>
      </div>
    </div>

    <!-- Che cosa arrivera. Sta DOPO la presentazione: prima si dice che cos'e
         Mirada, poi che cosa diventera. Vedi la nota nel componente. -->
    <app-tanghero-app />
  `,
  styles: [
    `
      .hero-wrap {
        padding-top: 3.5rem;
      }
      .hero {
        max-width: 46rem;
        margin: 0 auto 3rem;
        text-align: center;
      }
      .eyebrow {
        color: rgb(var(--accent-rgb));
        font-size: 0.78rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin: 0 0 0.75rem;
        font-weight: 600;
      }
      .hero-lead {
        margin: 1rem auto 0;
        font-size: 1.05rem;
      }
      .hero-cta {
        margin: 1.75rem 0 0;
      }

      .sides {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
        gap: 2rem;
        max-width: 56rem;
        margin: 0 auto;
      }
      .side p {
        margin: 0 0 0.7rem;
        color: rgba(var(--text-rgb), 0.78);
        line-height: 1.65;
      }
      .side p:last-child {
        margin-bottom: 0;
      }
      .side strong {
        color: rgb(var(--text-rgb));
        font-weight: 600;
      }

      @media (max-width: 560px) {
        .hero-wrap {
          padding-top: 2.5rem;
        }
        .hero {
          margin-bottom: 2.25rem;
          text-align: left;
        }
      }
    `,
  ],
})
export class HomePage {
  /** Vedi flags.ts: il richiamo al catalogo segue la vetrina. */
  protected readonly mostraVetrina = MOSTRA_VETRINA_EVENTI;

  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.apply({
      title: 'Mirada Tango — eventi di tango argentino',
      description:
        'La piattaforma su cui gli organizzatori costruiscono festival, marathon ed encuentro e ne ' +
        'vendono i titoli d’ingresso, e su cui chi balla li trova e si iscrive.',
      path: '/',
    });
    this.seo.setJsonLd(null);
  }
}
