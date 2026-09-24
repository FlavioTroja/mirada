import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';
import { MOSTRA_VETRINA_EVENTI } from '../../core/flags';
import { TangheroAppComponent } from './tanghero-app.component';
import { StoreBadgesComponent } from '../../shared/store-badges.component';

/**
 * `mirada.dance/` — la home. **Parla solo a chi balla.**
 *
 * ── A chi parla, e perché a uno solo ────────────────────────────────────────
 * Mirada, per chi balla, è l'app: scoprire le prossime serate, iscriversi ai
 * corsi della propria scuola, vedere dove vanno gli amici, scriversi. La home
 * esiste per portarli lì (decisione del committente, 24 settembre 2026).
 *
 * Prima parlava a due pubblici insieme — «chi organizza vende, chi balla
 * trova» — e un testo per due non parla a nessuno dei due. Chi organizza ha la
 * sua pagina, `app.mirada.dance`, che spiega tutto ciò che può gestire; da qui
 * ci si arriva con un link nel piede, e basta.
 *
 * ── L'app non c'è ancora, e la pagina non lo nasconde ───────────────────────
 * Gli store sono «presto» (`StoreBadgesComponent`), e ogni funzione è scritta
 * come ciò che l'app farà. Ciò che funziona **già oggi** — l'iscrizione a un
 * evento dal link che manda l'organizzatore — sta nelle domande frequenti, e
 * solo lì, con le parole che la pagina dell'evento conferma.
 *
 * ── Resa dal server ─────────────────────────────────────────────────────────
 * Cade sotto il `**` di `app.routes.server.ts`, quindi `RenderMode.Server`. E
 * cio che serve: e la pagina il cui indirizzo viene condiviso piu di ogni altro,
 * e nessuno dei crawler che contano esegue JavaScript.
 */
@Component({
  selector: 'app-home',
  imports: [TangheroAppComponent, RouterLink, StoreBadgesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- L'apertura sta nella fascia prugna, attaccata alla testata: su slesh.it
         testata e apertura sono un blocco solo. La fascia e la classe
         mirada-band di shared/mirada-theme.scss. -->
    <div class="apertura mirada-band">
      <div class="www-wrap hero-wrap">
        <header class="hero">
          <p class="eyebrow">L&rsquo;app di chi balla tango argentino</p>
          <h1 class="www-h1">Il tuo tango,<br />in tasca.</h1>
          <p class="www-lead hero-lead">
            Le milonghe e i festival dei prossimi giorni, i corsi della tua scuola, dove vanno a
            ballare i tuoi amici &mdash; e una chat per mettervi d&rsquo;accordo. Mirada &egrave;
            l&rsquo;app per Android e iPhone che parla la lingua di chi balla.
          </p>

          <div class="hero-store">
            <app-store-badges [centrati]="true" />
          </div>

          @if (mostraVetrina) {
            <p class="hero-cta">
              <a class="www-btn" routerLink="/eventi">Intanto, guarda gli eventi</a>
            </p>
          }
        </header>
      </div>
    </div>

    <!-- ── 2. La striscia ──────────────────────────────────────────────────
         Su slesh.it qui c'e la striscia dei loghi dei clienti. Qui: le occasioni
         in cui chi balla apre l'app. -->
    <div class="formule mirada-band">
      <div class="www-wrap formule-wrap">
        <p class="formule-titolo">Ogni occasione per ballare, in un posto solo:</p>
        <ul class="formule-lista">
          <li>Milonghe</li>
          <li>Corsi</li>
          <li>Festival</li>
          <li>Marathon</li>
          <li>Encuentro</li>
        </ul>
      </div>
    </div>

    <!-- ── 3. Il tratto bianco ─────────────────────────────────────────────
         Le quattro cose per cui si apre l'app, poi i telefoni. -->
    <div class="bianco">
      <div class="www-wrap">
        <div class="usi">
          <section class="uso">
            <span class="punto" aria-hidden="true"></span>
            <h2 class="www-h3">Scopri dove si balla</h2>
            <p>
              Milonghe, festival, marathon ed encuentro vicino a te o nella citt&agrave; in cui vai.
              Per ruolo, anche: un evento esaurito per i leader pu&ograve; avere ancora posto per i
              follower.
            </p>
          </section>
          <section class="uso">
            <span class="punto" aria-hidden="true"></span>
            <h2 class="www-h3">Iscriviti ai corsi</h2>
            <p>
              I corsi della tua scuola, le lezioni in calendario, l&rsquo;iscrizione con un tocco. E
              il biglietto sul telefono, pronto all&rsquo;ingresso.
            </p>
          </section>
          <section class="uso">
            <span class="punto" aria-hidden="true"></span>
            <h2 class="www-h3">Segui i tuoi amici</h2>
            <p>
              Dove vanno a ballare i tangheri che conosci, a quali serate e a quali festival. Per
              organizzare il viaggio insieme, o per trovarvi in pista.
            </p>
          </section>
          <section class="uso">
            <span class="punto" aria-hidden="true"></span>
            <h2 class="www-h3">Chatta con loro</h2>
            <p>
              Una chat per mettervi d&rsquo;accordo: chi guida, a che ora, chi porta le scarpe di
              ricambio. E per cercare un partner per quel workshop.
            </p>
          </section>
        </div>
      </div>

      <!-- I telefoni e le funzioni della fase 2 (12-app-tanghero.md). -->
      <app-tanghero-app />
    </div>

    <!-- ── 4. Il tratto prugna: le domande ─────────────────────────────────
         ⚠️ Ogni risposta dice SOLO cio che e vero oggi, o cio che questa pagina
         afferma gia qui sopra: una domanda frequente e il posto dove una
         promessa sembra piu solida di quanto sia. -->
    <section class="faq mirada-band" aria-labelledby="faq-title">
      <div class="www-wrap faq-wrap">
        <h2 id="faq-title" class="www-h1 faq-titolo">Domande frequenti</h2>

        <div class="faq-voci">
          <details>
            <summary>Quando posso scaricare l&rsquo;app?</summary>
            <p>
              Presto, su App Store e Google Play. La stiamo costruendo: quando sar&agrave; sugli
              store, i pulsanti qui sopra porteranno l&agrave;.
            </p>
          </details>
          <details>
            <summary>Posso gi&agrave; iscrivermi a un evento?</summary>
            <p>
              S&igrave;. Se un organizzatore ti manda il link del suo evento, ti iscrivi e paghi da
              l&igrave;, e il biglietto arriva per email con il suo codice.
            </p>
          </details>
          <details>
            <summary>Serve un account?</summary>
            <p>
              Per guardare no. Serve quando ti iscrivi, perch&eacute; il biglietto &egrave; tuo e
              deve poterti seguire.
            </p>
          </details>
          <details>
            <summary>Perch&eacute; conta il mio ruolo di ballo?</summary>
            <p>
              Perch&eacute; un evento esaurito per i leader pu&ograve; avere ancora posto per i
              follower: sapere quale dei due sei cambia la risposta.
            </p>
          </details>
          <details>
            <summary>E se poi non posso andare?</summary>
            <p>Il nominativo si trasferisce: il posto non si perde.</p>
          </details>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .hero-wrap {
        padding-top: 3.5rem;
        padding-bottom: 4rem;
      }
      .hero {
        max-width: 46rem;
        margin: 0 auto;
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
      .hero-store {
        margin: 2rem 0 0;
      }
      .hero-cta {
        margin: 1.5rem 0 0;
      }

      /* ── 2. Le formule ────────────────────────────────────────────── */
      /* La sfumatura della striscia dei loghi di slesh.it: prugna con due
         aloni, viola e malva. Il testo resta sul prugna pieno: 18:1. */
      .formule {
        background:
          radial-gradient(45% 140% at 25% 50%, rgba(148, 75, 187, 0.32), transparent 70%),
          radial-gradient(40% 140% at 78% 50%, rgba(140, 80, 100, 0.38), transparent 70%),
          rgb(var(--mirada-night));
      }
      .formule-wrap {
        padding-top: 2.75rem;
        padding-bottom: 3rem;
      }
      .formule-titolo {
        margin: 0 0 1.5rem;
        font-weight: 600;
      }
      .formule-lista {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-around;
        gap: 1rem 2.5rem;
        font-size: clamp(1.5rem, 1rem + 2vw, 2.4rem);
        font-weight: 700;
        letter-spacing: -0.01em;
      }

      /* ── 3. Il tratto bianco ─────────────────────────────────────────── */
      .bianco {
        background: rgb(var(--foreground-color));
        padding-top: 2.5rem;
      }
      .usi {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
        gap: 1.25rem;
        max-width: 64rem;
        margin: 0 auto;
      }
      /* Le schede tinte di slesh.it, con il pallino del colore. Testo prugna
         sulla tinta: 18:1. */
      .uso {
        border-radius: var(--www-radius);
        padding: 1.5rem 1.6rem;
        border: 1px solid rgba(var(--text-rgb), 0.06);
        background: #f7f0fb;
      }
      .uso h2 {
        margin: 0 0 0.6rem;
      }
      .uso p {
        margin: 0;
        color: rgba(var(--text-rgb), 0.78);
        line-height: 1.65;
      }
      .punto {
        display: block;
        width: 0.8rem;
        height: 0.8rem;
        border-radius: 50%;
        margin-bottom: 0.9rem;
        background: rgb(var(--mirada-violet));
      }
      :host-context([data-theme='dark']) .uso {
        background: rgba(var(--text-rgb), 0.05);
      }

      /* ── 4. Le domande ───────────────────────────────────────────────── */
      .faq-wrap {
        padding-top: 4rem;
        padding-bottom: 4.5rem;
      }
      .faq-titolo {
        text-align: center;
        margin-bottom: 2.5rem;
      }
      .faq-voci {
        max-width: 44rem;
        margin: 0 auto;
      }
      .faq-voci details {
        border-bottom: 1px solid rgba(var(--text-rgb), 0.14);
      }
      .faq-voci summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.95rem 0;
        font-weight: 600;
      }
      .faq-voci summary::-webkit-details-marker {
        display: none;
      }
      .faq-voci summary::after {
        content: '⌄';
        color: rgba(var(--text-rgb), 0.7);
        transition: transform 0.2s ease;
      }
      .faq-voci details[open] summary::after {
        transform: rotate(180deg);
      }
      .faq-voci p {
        margin: 0 0 1rem;
        color: rgba(var(--text-rgb), 0.78); /* 12:1 sul prugna */
        line-height: 1.65;
      }

      @media (max-width: 560px) {
        .hero-wrap {
          padding-top: 2.5rem;
          padding-bottom: 3rem;
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
      title: 'Mirada Tango — l’app di chi balla tango argentino',
      description:
        'Milonghe, festival e corsi della tua scuola, dove vanno a ballare i tuoi amici e una chat ' +
        'per mettervi d’accordo. Presto su App Store e Google Play.',
      path: '/',
    });
    this.seo.setJsonLd(null);
  }
}
