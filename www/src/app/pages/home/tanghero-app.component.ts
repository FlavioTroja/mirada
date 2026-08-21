import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * La banda che racconta l'app del tanghero, in fondo alla home.
 *
 * ── Perché sta SOTTO la presentazione ───────────────────────────────────────
 * La home dice prima che cos'e Mirada — a chi organizza e a chi balla — e solo
 * dopo che cosa arrivera. L'ordine inverso presenterebbe il seguito di una cosa
 * che il visitatore non sa ancora che cosa sia.
 *
 * ── L'app NON esiste ancora, e il testo lo dice ─────────────────────────────
 * E fase 2 (`12-app-tanghero.md`). Niente distintivi App Store che non portano
 * da nessuna parte, niente verbi al presente: si annuncia, non si finge. Una
 * pagina che promette un prodotto scaricabile e non lo consegna brucia la sola
 * cosa che questa banda serve a costruire.
 *
 * ── Le schermate sono SVG, non fotografie ───────────────────────────────────
 * Tre ragioni, e nessuna estetica. Restano nitide a ogni densita; pesano
 * qualche kB invece delle centinaia di un PNG (e WhatsApp scarta le immagini
 * oltre circa 300 kB — vedi CLAUDE.md); e soprattutto **non mentono**: sono
 * mock dichiarati, non catture di un'app che nessuno ha ancora aperto.
 *
 * ── I telefoni sono scuri anche nel tema chiaro ─────────────────────────────
 * Non e una svista. L'app eredita la palette della wall (`RF-WALL-31`, e
 * `12-app-tanghero.md` §7): fondo molto scuro e testo avorio, perche uno
 * schermo chiaro in una sala buia abbaglia chi balla. Dipingere i mock con le
 * variabili di tema li farebbe diventare bianchi di giorno, cioe mostrerebbe
 * un'app che non esistera mai. Usano quindi le **costanti di marca**
 * (`--mirada-*`), che per definizione non dipendono dal tema.
 */
@Component({
  selector: 'app-tanghero-app',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tang" aria-labelledby="tang-title">
      <header class="tang-head">
        <p class="eyebrow">L&rsquo;app del tanghero &middot; in arrivo</p>
        <h2 id="tang-title" class="www-h1">Il tuo tango, in tasca.</h2>
        <p class="www-lead">
          Non un gestionale con un&rsquo;icona. L&rsquo;app che stiamo costruendo parla la lingua di
          chi balla: orchestre e cantanti, ruoli e stili, le citt&agrave; da cui arriva la pista.
          Ecco che cosa ci sar&agrave; dentro.
        </p>
      </header>

      <!-- ── I tre schermi ────────────────────────────────────────────────── -->
      <div class="screens">
        <!-- 1. La tanda che sta suonando -->
        <figure class="phone">
          <svg viewBox="0 0 260 520" role="img" aria-labelledby="scr1-t" class="phone-svg">
            <title id="scr1-t">
              Schermata dell&rsquo;app durante una milonga: mostra la tanda in corso, orchestra Di
              Sarli con Rufino del 1944, e la tanda successiva
            </title>
            <defs>
              <linearGradient id="g-live" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="rgb(var(--mirada-bordeaux))" stop-opacity="0.55" />
                <stop offset="1" stop-color="rgb(var(--mirada-surface))" stop-opacity="0" />
              </linearGradient>
            </defs>

            <rect x="4" y="4" width="252" height="512" rx="34" class="frame" />
            <rect x="12" y="12" width="236" height="496" rx="27" class="screen" />
            <rect x="104" y="22" width="52" height="5" rx="2.5" class="speaker" />

            <rect x="12" y="40" width="236" height="170" fill="url(#g-live)" />

            <text x="30" y="62" class="t-eyebrow">MILONGA SUL MOLO</text>
            <circle cx="190" cy="58" r="3.5" class="dot-live" />
            <text x="224" y="62" class="t-live" text-anchor="end">LIVE</text>

            <text x="30" y="106" class="t-huge">Di Sarli</text>
            <text x="30" y="130" class="t-body">con Roberto Rufino &middot; 1944</text>
            <rect x="30" y="144" width="52" height="20" rx="10" class="chip" />
            <text x="56" y="158" class="t-chip" text-anchor="middle">TANGO</text>

            <!-- Quattro barre per quattro brani. Due piene, la terza a meta, la
                 quarta spenta: e la lettura che il testo sotto dichiara. Cinque
                 barre direbbero cinque brani, e la didascalia direbbe il
                 contrario di cio che si vede. -->
            <rect x="30" y="184" width="44" height="4" rx="2" class="bar-on" />
            <rect x="80" y="184" width="44" height="4" rx="2" class="bar-on" />
            <rect x="130" y="184" width="44" height="4" rx="2" class="bar-off" />
            <rect x="130" y="184" width="22" height="4" rx="2" class="bar-on" />
            <rect x="180" y="184" width="44" height="4" rx="2" class="bar-off" />
            <text x="30" y="204" class="t-small">Terzo brano di quattro</text>

            <line x1="30" y1="232" x2="230" y2="232" class="rule" />

            <text x="30" y="256" class="t-eyebrow">POI</text>
            <text x="30" y="282" class="t-mid">D&rsquo;Arienzo</text>
            <text x="30" y="302" class="t-body">con Echag&uuml;e &middot; 1938</text>
            <rect x="30" y="314" width="42" height="18" rx="9" class="chip-soft" />
            <text x="51" y="327" class="t-chip-soft" text-anchor="middle">VALS</text>

            <line x1="30" y1="356" x2="230" y2="356" class="rule" />

            <rect x="30" y="376" width="200" height="40" rx="20" class="cta" />
            <path
              d="M52 396 l5 5 l9 -11"
              class="cta-tick"
              fill="none"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <text x="76" y="401" class="t-cta">Salva questa tanda</text>

            <text x="30" y="440" class="t-small">
              Finisce nel tuo archivio: orchestra, anno, serata.
            </text>
            <text x="30" y="456" class="t-small">Su Trani, 21 marzo, con DJ Alma.</text>
          </svg>
          <figcaption class="cap">
            <strong>La tanda che sta suonando.</strong>
            Il DJ tocca una volta sola, all&rsquo;inizio della tanda: nessuno digita al buio.
          </figcaption>
        </figure>

        <!-- 2. Il passaporto -->
        <figure class="phone">
          <svg viewBox="0 0 260 520" role="img" aria-labelledby="scr2-t" class="phone-svg">
            <title id="scr2-t">
              Schermata con la notifica di arrivo in location, il pass digitale con il codice QR e lo
              storico personale delle serate
            </title>
            <rect x="4" y="4" width="252" height="512" rx="34" class="frame" />
            <rect x="12" y="12" width="236" height="496" rx="27" class="screen" />
            <rect x="104" y="22" width="52" height="5" rx="2.5" class="speaker" />

            <!-- La notifica geolocalizzata all'arrivo -->
            <rect x="24" y="44" width="212" height="58" rx="14" class="toast" />
            <circle cx="44" cy="66" r="8" class="toast-mark" />
            <path
              d="M44 62 v8 M40 66 h8"
              class="toast-cross"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <text x="60" y="64" class="t-toast-title">Benvenuto alla Milonga sul Molo</text>
            <text x="60" y="80" class="t-toast">Il tuo pass &egrave; pronto per il check-in.</text>
            <text x="60" y="94" class="t-toast-dim">ora</text>

            <!-- Il pass, formato portafoglio -->
            <rect x="24" y="122" width="212" height="196" rx="18" class="pass" />
            <rect x="24" y="122" width="212" height="46" rx="18" class="pass-head" />
            <rect x="24" y="150" width="212" height="18" class="pass-head" />
            <text x="42" y="151" class="t-pass-title">International Trani Tango</text>
            <text x="42" y="186" class="t-pass-label">TITOLARE</text>
            <text x="42" y="202" class="t-pass-value">Marta Bianchi</text>
            <text x="150" y="186" class="t-pass-label">RUOLO</text>
            <text x="150" y="202" class="t-pass-value">Follower</text>

            <!-- Il QR, disegnato: un quadrato leggibile a colpo d'occhio -->
            <rect x="96" y="216" width="68" height="68" rx="6" class="qr-bg" />
            <g class="qr-ink">
              <rect x="104" y="224" width="14" height="14" rx="2" />
              <rect x="142" y="224" width="14" height="14" rx="2" />
              <rect x="104" y="262" width="14" height="14" rx="2" />
              <rect x="124" y="228" width="5" height="5" />
              <rect x="132" y="236" width="5" height="5" />
              <rect x="124" y="244" width="5" height="5" />
              <rect x="140" y="248" width="5" height="5" />
              <rect x="148" y="256" width="5" height="5" />
              <rect x="132" y="264" width="5" height="5" />
              <rect x="124" y="272" width="5" height="5" />
              <rect x="148" y="272" width="5" height="5" />
            </g>
            <text x="130" y="300" class="t-small" text-anchor="middle">Ven 21 &middot; 22:30</text>

            <line x1="24" y1="342" x2="236" y2="342" class="rule" />

            <text x="24" y="366" class="t-eyebrow">IL TUO PASSAPORTO</text>
            <text x="24" y="404" class="t-stat">38</text>
            <text x="24" y="420" class="t-small">serate</text>
            <text x="104" y="404" class="t-stat">11</text>
            <text x="104" y="420" class="t-small">citt&agrave;</text>
            <text x="176" y="404" class="t-stat">6</text>
            <text x="176" y="420" class="t-small">paesi</text>

            <text x="24" y="452" class="t-body">Pi&ugrave; ballata: Pugliese</text>
            <text x="24" y="470" class="t-small">Dal 2019 a oggi</text>
          </svg>
          <figcaption class="cap">
            <strong>Il passaporto.</strong>
            Il pass nel portafoglio del telefono, e lo storico di tutto quello che hai ballato.
          </figcaption>
        </figure>

        <!-- 3. Chi c'e in pista -->
        <figure class="phone">
          <svg viewBox="0 0 260 520" role="img" aria-labelledby="scr3-t" class="phone-svg">
            <title id="scr3-t">
              Schermata con le provenienze dei partecipanti: duecentoquattordici ballerini da
              diciassette paesi, con le citt&agrave; principali
            </title>
            <rect x="4" y="4" width="252" height="512" rx="34" class="frame" />
            <rect x="12" y="12" width="236" height="496" rx="27" class="screen" />
            <rect x="104" y="22" width="52" height="5" rx="2.5" class="speaker" />

            <text x="30" y="62" class="t-eyebrow">CHI C&rsquo;&Egrave; IN PISTA</text>
            <text x="30" y="96" class="t-huge">214</text>
            <text x="30" y="118" class="t-body">ballerini da 17 paesi</text>

            <!-- Gli archi: rotte verso Trani, non una mappa vera -->
            <g class="arcs" fill="none" stroke-width="1.2">
              <path d="M40 210 C 80 150, 150 150, 196 196" />
              <path d="M52 250 C 90 200, 160 180, 196 196" />
              <path d="M46 176 C 100 140, 160 160, 196 196" />
              <path d="M62 288 C 110 260, 170 220, 196 196" />
            </g>
            <circle cx="196" cy="196" r="6" class="hub" />
            <circle cx="196" cy="196" r="12" class="hub-halo" />
            <text x="196" y="222" class="t-hub" text-anchor="middle">TRANI</text>

            <circle cx="40" cy="210" r="3" class="node" />
            <circle cx="52" cy="250" r="3" class="node" />
            <circle cx="46" cy="176" r="3" class="node" />
            <circle cx="62" cy="288" r="3" class="node" />

            <line x1="30" y1="326" x2="230" y2="326" class="rule" />

            <text x="30" y="352" class="t-body">Parigi</text>
            <text x="230" y="352" class="t-count" text-anchor="end">18</text>
            <rect x="30" y="360" width="140" height="3" rx="1.5" class="bar-on" />

            <text x="30" y="392" class="t-body">Berlino</text>
            <text x="230" y="392" class="t-count" text-anchor="end">14</text>
            <rect x="30" y="400" width="108" height="3" rx="1.5" class="bar-on" />

            <text x="30" y="432" class="t-body">Buenos Aires</text>
            <text x="230" y="432" class="t-count" text-anchor="end">6</text>
            <rect x="30" y="440" width="46" height="3" rx="1.5" class="bar-on" />

            <text x="30" y="474" class="t-small">Numeri, non profili.</text>
            <text x="30" y="490" class="t-small">Il nome lo mostra solo chi sceglie di mostrarlo.</text>
          </svg>
          <figcaption class="cap">
            <strong>Chi c&rsquo;&egrave; in pista.</strong>
            Le provenienze di chi &egrave; in sala, in forma aggregata: nessun profilo esposto.
          </figcaption>
        </figure>
      </div>

      <!-- ── I cinque punti ──────────────────────────────────────────────── -->
      <ul class="points">
        <li class="point">
          <svg viewBox="0 0 24 24" class="ico" aria-hidden="true" fill="none" stroke-width="1.5">
            <circle cx="8.5" cy="8" r="3.2" />
            <circle cx="16" cy="14" r="3.2" />
            <path d="M11 10.5 L13.5 12" stroke-linecap="round" />
            <path d="M4 20 v-1.5 a3 3 0 0 1 3 -3 h2" stroke-linecap="round" />
            <path d="M20 20 v-0.5 a3 3 0 0 0 -3 -3" stroke-linecap="round" />
          </svg>
          <h3 class="www-h3">Un partner per quel workshop</h3>
          <p>
            Si cerca per <strong>una lezione precisa</strong>, non una persona: il seminario di
            sabato alle 15 sulla milonga con traspi&eacute;. Ruolo, livello e soprattutto
            <strong>stile</strong> &mdash; milonguero, salon, nuevo &mdash; perch&eacute; due
            avanzati di scuole diverse ballano peggio insieme di due intermedi dello stesso stile.
          </p>
          <p class="www-hint">
            Nessun filtro di genere, et&agrave; o distanza. Nessun profilo che compare a caso.
            Trovato il partner, ci si iscrive in due con un ordine solo.
          </p>
        </li>

        <li class="point">
          <svg viewBox="0 0 24 24" class="ico" aria-hidden="true" fill="none" stroke-width="1.5">
            <path d="M9 18V6l10-2v12" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="6.5" cy="18" r="2.5" />
            <circle cx="16.5" cy="16" r="2.5" />
          </svg>
          <h3 class="www-h3">La tanda, mentre suona</h3>
          <p>
            Orchestra, cantante, anno e stile della tanda in corso &mdash; e la successiva, se il DJ
            ha reso pubblica la scaletta. Salvi una tanda e finisce nel tuo archivio con la serata
            in cui l&rsquo;hai ballata.
          </p>
          <p class="www-hint">
            Il collegamento a Spotify e Apple Music c&rsquo;&egrave; quando l&rsquo;incisione esiste
            davvero: molte tande vengono da rimasterizzazioni che sui servizi di ascolto non ci
            sono, e proporti la versione sbagliata sarebbe peggio che non proporne nessuna.
          </p>
        </li>

        <li class="point">
          <svg viewBox="0 0 24 24" class="ico" aria-hidden="true" fill="none" stroke-width="1.5">
            <rect x="3" y="6" width="18" height="13" rx="2.5" />
            <path d="M3 10h18" />
            <path d="M12 2.5c2.2 1.6 2.2 2.4 0 3.5" stroke-linecap="round" />
            <circle cx="16.5" cy="14.5" r="1.6" />
          </svg>
          <h3 class="www-h3">Il pass, e il passaporto</h3>
          <p>
            Il biglietto nel portafoglio di Apple e Google, che si aggiorna da solo se cambia sala o
            orario. Quando arrivi in location il telefono te lo mette davanti da s&eacute;: niente
            code a cercare l&rsquo;email di conferma.
          </p>
          <p class="www-hint">
            E lo storico: serate, citt&agrave;, maestri, orchestre. Comprese quelle che non hai
            comprato qui &mdash; uno storico con dei buchi non &egrave; uno storico.
          </p>
        </li>

        <li class="point">
          <svg viewBox="0 0 24 24" class="ico" aria-hidden="true" fill="none" stroke-width="1.5">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M3.5 12h17" />
            <path d="M12 3.5c2.6 2.6 2.6 14.4 0 17" />
            <path d="M12 3.5c-2.6 2.6 -2.6 14.4 0 17" />
          </svg>
          <h3 class="www-h3">Da dove arriva la pista</h3>
          <p>
            Vedere che nella stessa sala ci sono ballerini arrivati da Parigi, Berlino e Buenos
            Aires cambia la serata. In forma aggregata: citt&agrave;, paese, quanti.
          </p>
          <p class="www-hint">
            Il numero &egrave; di tutti, il nome &egrave; di chi sceglie di mostrarlo, il contatto
            richiede il s&igrave; di tutti e due.
          </p>
        </li>

        <li class="point">
          <svg viewBox="0 0 24 24" class="ico" aria-hidden="true" fill="none" stroke-width="1.5">
            <path d="M3 16.5V12l2-5h11l3 5h2v4.5" stroke-linejoin="round" />
            <circle cx="7.5" cy="17" r="2" />
            <circle cx="17" cy="17" r="2" />
            <path d="M9.5 17h5.5" />
          </svg>
          <h3 class="www-h3">La bacheca dei nomadi</h3>
          <p>
            &laquo;Parto da Roma venerd&igrave;, ho due posti in auto.&raquo; &laquo;Ho preso una
            casa vicino al porto, chi divide una stanza?&raquo; Il tango viaggia, e oggi lo organizza
            in gruppi dispersi.
          </p>
          <p class="www-hint">
            Mirada &egrave; la bacheca, non l&rsquo;intermediario: non verifica i conducenti, non
            risponde delle sistemazioni, e fra le parti non passa denaro.
          </p>
        </li>
      </ul>

      <p class="closing www-muted">
        L&rsquo;app arriva dopo la biglietteria: prima gli organizzatori devono poter vendere, poi
        chi balla avr&agrave; il suo posto. Intanto tutto quello che compri qui finisce l&igrave;
        dentro il giorno in cui esce.
      </p>
    </section>
  `,
  styles: [
    `
      /* Banda a tutta larghezza dentro un contenitore che larghezza piena non
         ha: il margine negativo la fa uscire dal contenitore di pagina e il
         padding le ridà il respiro. Serve a staccarla dai risultati: una
         sezione che cambia argomento e continua sullo stesso fondo legge
         come un seguito della ricerca. */
      .tang {
        margin: 4rem -1.25rem 0;
        padding: 3.5rem 1.25rem 3rem;
        background: rgb(var(--foreground-color));
        border-top: 1px solid var(--www-line);
      }

      .tang-head {
        max-width: 46rem;
        margin: 0 auto 2.5rem;
        text-align: center;
      }
      .eyebrow {
        color: rgb(var(--accent-rgb));
        font-size: 0.78rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin: 0 0 0.6rem;
        font-weight: 600;
      }

      /* --- I tre telefoni ------------------------------------------------- */
      .screens {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
        gap: 2rem;
        max-width: 62rem;
        margin: 0 auto;
        align-items: start;
      }
      .phone {
        margin: 0;
        text-align: center;
      }
      .phone-svg {
        width: 100%;
        max-width: 15rem;
        height: auto;
        display: block;
        margin: 0 auto;
        filter: drop-shadow(0 18px 34px rgba(0, 0, 0, 0.45));
      }
      .cap {
        margin: 1rem auto 0;
        max-width: 20rem;
        font-size: 0.86rem;
        line-height: 1.55;
        color: rgba(var(--text-rgb), 0.7);
      }
      .cap strong {
        color: rgb(var(--text-rgb));
        display: block;
      }

      /* --- Dentro lo schermo ---------------------------------------------
         Dipinto con le COSTANTI DI MARCA e non con le variabili di tema: il
         mock deve restare scuro anche quando il sito è chiaro, perché l'app è
         scura per progetto (RF-WALL-31 — uno schermo chiaro in una sala buia
         abbaglia chi balla). Vedi la nota in testa al componente. */
      .frame {
        fill: #2a1a20;
        stroke: rgba(224, 184, 79, 0.35);
        stroke-width: 1;
      }
      .screen {
        fill: rgb(var(--mirada-black));
      }
      .speaker {
        fill: rgba(243, 233, 220, 0.18);
      }
      .rule {
        stroke: rgba(243, 233, 220, 0.14);
        stroke-width: 1;
      }

      .t-eyebrow {
        fill: rgba(243, 233, 220, 0.5);
        font-size: 8px;
        letter-spacing: 0.16em;
        font-weight: 600;
      }
      .t-huge {
        fill: rgb(var(--mirada-gold));
        font-size: 30px;
        font-weight: 600;
      }
      .t-mid {
        fill: rgb(var(--mirada-ivory));
        font-size: 17px;
        font-weight: 600;
      }
      .t-body {
        fill: rgba(243, 233, 220, 0.82);
        font-size: 11px;
      }
      .t-small {
        fill: rgba(243, 233, 220, 0.55);
        font-size: 9px;
      }
      .t-stat {
        fill: rgb(var(--mirada-gold));
        font-size: 24px;
        font-weight: 600;
      }
      .t-count {
        fill: rgb(var(--mirada-gold));
        font-size: 11px;
        font-weight: 600;
      }
      .t-hub {
        fill: rgb(var(--mirada-gold));
        font-size: 8px;
        letter-spacing: 0.14em;
        font-weight: 600;
      }

      .dot-live {
        fill: #ff8a80;
      }
      .t-live {
        fill: #ff8a80;
        font-size: 8px;
        letter-spacing: 0.14em;
        font-weight: 600;
      }

      .chip {
        fill: rgba(224, 184, 79, 0.16);
        stroke: rgba(224, 184, 79, 0.4);
        stroke-width: 0.8;
      }
      .t-chip {
        fill: rgb(var(--mirada-gold));
        font-size: 8px;
        letter-spacing: 0.1em;
        font-weight: 600;
      }
      .chip-soft {
        fill: rgba(243, 233, 220, 0.08);
      }
      .t-chip-soft {
        fill: rgba(243, 233, 220, 0.6);
        font-size: 8px;
        letter-spacing: 0.1em;
      }

      .bar-on {
        fill: rgb(var(--mirada-gold));
      }
      .bar-off {
        fill: rgba(243, 233, 220, 0.16);
      }

      .cta {
        fill: rgba(106, 26, 45, 0.85);
        stroke: rgba(224, 184, 79, 0.45);
        stroke-width: 1;
      }
      .cta-tick {
        stroke: rgb(var(--mirada-gold));
      }
      .t-cta {
        fill: rgb(var(--mirada-ivory));
        font-size: 12px;
        font-weight: 600;
      }

      .toast {
        fill: rgba(243, 233, 220, 0.07);
        stroke: rgba(243, 233, 220, 0.14);
        stroke-width: 1;
      }
      .toast-mark {
        fill: rgba(106, 26, 45, 0.9);
      }
      .toast-cross {
        stroke: rgb(var(--mirada-gold));
      }
      .t-toast-title {
        fill: rgb(var(--mirada-ivory));
        font-size: 9.5px;
        font-weight: 600;
      }
      .t-toast {
        fill: rgba(243, 233, 220, 0.72);
        font-size: 9px;
      }
      .t-toast-dim {
        fill: rgba(243, 233, 220, 0.4);
        font-size: 8px;
      }

      .pass {
        fill: rgba(243, 233, 220, 0.05);
        stroke: rgba(224, 184, 79, 0.3);
        stroke-width: 1;
      }
      .pass-head {
        fill: rgba(106, 26, 45, 0.75);
      }
      .t-pass-title {
        fill: rgb(var(--mirada-ivory));
        font-size: 11px;
        font-weight: 600;
      }
      .t-pass-label {
        fill: rgba(243, 233, 220, 0.45);
        font-size: 7.5px;
        letter-spacing: 0.12em;
      }
      .t-pass-value {
        fill: rgb(var(--mirada-ivory));
        font-size: 11px;
      }
      .qr-bg {
        fill: rgb(var(--mirada-ivory));
      }
      .qr-ink rect {
        fill: #14090d;
      }

      .arcs {
        stroke: rgba(224, 184, 79, 0.45);
      }
      .node {
        fill: rgba(243, 233, 220, 0.6);
      }
      .hub {
        fill: rgb(var(--mirada-gold));
      }
      .hub-halo {
        fill: rgba(224, 184, 79, 0.18);
      }

      /* --- I cinque punti -------------------------------------------------- */
      .points {
        list-style: none;
        margin: 3.5rem auto 0;
        padding: 0;
        max-width: 62rem;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
        gap: 1.75rem 2rem;
      }
      .point p {
        margin: 0 0 0.5rem;
        color: rgba(var(--text-rgb), 0.78);
        line-height: 1.6;
        font-size: 0.94rem;
      }
      .point p:last-child {
        margin-bottom: 0;
      }
      .point strong {
        color: rgb(var(--text-rgb));
        font-weight: 600;
      }
      .ico {
        width: 1.75rem;
        height: 1.75rem;
        display: block;
        margin-bottom: 0.6rem;
        stroke: rgb(var(--accent-rgb));
      }

      .closing {
        max-width: 46rem;
        margin: 3rem auto 0;
        text-align: center;
        line-height: 1.65;
      }

      /* Sul telefono i tre mock in colonna diventano tre schermate di scorrimento
         prima di arrivare al testo. Si stringono, così la banda resta leggibile
         senza diventare un tunnel. */
      @media (max-width: 560px) {
        .tang {
          margin-top: 3rem;
          padding: 2.5rem 1.25rem 2.5rem;
        }
        .phone-svg {
          max-width: 11.5rem;
        }
        .screens {
          gap: 2.5rem;
        }
        .points {
          margin-top: 2.5rem;
        }
      }
    `,
  ],
})
export class TangheroAppComponent {}
