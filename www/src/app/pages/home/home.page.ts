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
    <!-- L'apertura sta nella fascia prugna, attaccata alla testata: su slesh.it
         testata e apertura sono un blocco solo. La fascia e la classe
         mirada-band di shared/mirada-theme.scss. -->
    <div class="apertura mirada-band">
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
    </div>
    </div>

    <!-- ── 2. La striscia delle formule ─────────────────────────────────────
         Su slesh.it qui c'e la striscia dei loghi dei clienti. Loghi non ne
         abbiamo, e inventarli sarebbe il contrario di cio che la pagina deve
         fare: al loro posto le formule che Mirada gestisce davvero. -->
    <div class="formule mirada-band">
      <div class="www-wrap formule-wrap">
        <p class="formule-titolo">Per ogni formula del tango argentino:</p>
        <ul class="formule-lista">
          <li>Festival</li>
          <li>Marathon</li>
          <li>Encuentro</li>
          <li>Stage</li>
        </ul>
      </div>
    </div>

    <!-- ── 3. Il tratto bianco ─────────────────────────────────────────────
         Un fondo solo, come il lungo tratto chiaro di slesh.it: i due lati
         della piattaforma e poi l'app. Prima erano due bianchi diversi, perla
         e bianco, e il ritmo delle fasce non si leggeva. -->
    <div class="bianco">
    <div class="www-wrap">
      <!-- I due lati della piattaforma. Sono due mestieri diversi e vanno detti
           separati: un organizzatore e un ballerino non cercano la stessa cosa,
           e un testo solo per entrambi non parla a nessuno dei due. -->
      <div class="sides">
        <section class="side side-org">
          <span class="punto" aria-hidden="true"></span>
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

        <section class="side side-balla">
          <span class="punto" aria-hidden="true"></span>
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
    </div>

    <!-- ── 4. Il tratto prugna: le domande ─────────────────────────────────
         Come le domande frequenti di slesh.it, a gruppi. ⚠️ Ogni risposta dice
         SOLO cio che questa pagina afferma gia, qui sopra: una domanda
         frequente e il posto dove una promessa sembra piu solida di quanto
         sia, e non e il posto per farne di nuove. -->
    <section class="faq mirada-band" aria-labelledby="faq-title">
      <div class="www-wrap faq-wrap">
        <h2 id="faq-title" class="www-h1 faq-titolo">Domande frequenti</h2>

        <div class="faq-gruppo">
          <h3 class="faq-nome">Per chi balla</h3>
          <div class="faq-voci">
            <details>
              <summary>Serve un account per guardare gli eventi?</summary>
              <p>
                No. Serve quando compri, perch&eacute; il biglietto &egrave; tuo e deve poterti
                seguire.
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

        <div class="faq-gruppo">
          <h3 class="faq-nome">Per chi organizza</h3>
          <div class="faq-voci">
            <details>
              <summary>Il check-in funziona senza internet?</summary>
              <p>
                S&igrave;. Il codice si verifica sul dispositivo, e la coda all&rsquo;ingresso non
                dipende dal wi-fi della sala.
              </p>
            </details>
            <details>
              <summary>Vendo gi&agrave; su un mio negozio online. Devo smettere?</summary>
              <p>No: le vendite fatte altrove entrano qui da sole, e i biglietti li emette Mirada.</p>
            </details>
            <details>
              <summary>Il documento che riceve chi compra &egrave; fiscale?</summary>
              <p>
                No. &Egrave; una conferma d&rsquo;ordine con il QR di accesso, mai un titolo fiscale:
                Mirada &egrave; uno strumento di vendita, non un intermediario fiscale.
              </p>
            </details>
          </div>
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
      .hero-cta {
        margin: 1.75rem 0 0;
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
      .sides {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
        gap: 1.25rem;
        max-width: 56rem;
        margin: 0 auto;
      }
      /* Le schede tinte di slesh.it, con il pallino del colore. Testo prugna
         sulle due tinte: 18:1. */
      .side {
        border-radius: var(--www-radius);
        padding: 1.5rem 1.6rem;
        border: 1px solid rgba(var(--text-rgb), 0.06);
      }
      .side-org {
        background: #f7f0fb;
      }
      .side-balla {
        background: #fff8ec;
      }
      .punto {
        display: block;
        width: 0.8rem;
        height: 0.8rem;
        border-radius: 50%;
        margin-bottom: 0.9rem;
      }
      .side-org .punto {
        background: rgb(var(--mirada-violet));
      }
      .side-balla .punto {
        background: #e0a33a;
      }
      :host-context([data-theme='dark']) .side-org,
      :host-context([data-theme='dark']) .side-balla {
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
      .faq-gruppo {
        display: grid;
        grid-template-columns: minmax(12rem, 1fr) 2fr;
        gap: 1rem 2rem;
        max-width: 56rem;
        margin: 0 auto 2.5rem;
      }
      .faq-nome {
        margin: 0.9rem 0 0;
        font-size: 1.25rem;
        font-weight: 600;
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
      @media (max-width: 640px) {
        .faq-gruppo {
          grid-template-columns: 1fr;
        }
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
          padding-bottom: 3rem;
        }
        .hero {
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
