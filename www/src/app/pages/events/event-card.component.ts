import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicEventCard } from '../../core/domain/models';
import { dateRange, moneyShort, text } from '../../core/format/format';
import { I18nTextComponent } from '../../shared/i18n-text.component';

/**
 * La scheda di un evento nella bacheca dei risultati.
 *
 * ## Cosa mostra, e cosa no
 *
 * **La locandina è il contenuto**, non un'illustrazione a lato: è l'oggetto con
 * cui gli organizzatori comunicano l'evento e con cui i ballerini lo
 * riconoscono. Occupa quindi la scheda intera, in un riquadro verticale 3:4
 * mostrata **intera** (`object-fit: contain`), e sotto restano poche righe:
 *
 *     tipo di evento · titolo · date · città · «da € …»
 *
 * Tutto il resto — programma, cast, tipi di biglietto, capienza per ruolo — sta
 * nella scheda dell'evento. È il motivo per cui questa è breve: si apre per
 * vedere il resto.
 *
 * ## L'unica eccezione, e perché è un'eccezione
 *
 * Sopra la locandina compare una pastiglia **solo negli stati che cambiano la
 * decisione**: esaurito, o iscrizioni di un ruolo in pausa. «Iscrizioni aperte»
 * non compare: è lo stato normale, e ripeterlo su ogni scheda toglie
 * l'attenzione proprio alle due che dicono qualcosa. Il conteggio dei posti per
 * ruolo, che prima stava qui, è passato alla scheda dell'evento — su una
 * bacheca era una riga di numeri sotto ogni locandina, e nessuno la leggeva.
 *
 * ## Un solo bersaglio cliccabile
 *
 * Tutta la scheda è un `<a>`. Prima erano due — la locandina e il titolo — che
 * portavano allo stesso posto: due fermate della tastiera per una destinazione,
 * e su un elenco di venti eventi sono quaranta tabulazioni per arrivare in
 * fondo. Il titolo resta dentro l'`<h3>` per la struttura del documento, ma non
 * è più un collegamento a sé.
 */
@Component({
  selector: 'app-event-card',
  imports: [RouterLink, I18nTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="scheda">
      <a class="tutto" [routerLink]="['/eventi', event().slug]" [attr.aria-label]="etichetta()">
        <div class="locandina">
          @if (event().posterVerticalUrl) {
            <!-- 'alt' vuoto di proposito: il collegamento che avvolge l'immagine
                 porta gia' 'aria-label' con titolo, date e luogo. Un 'alt' con
                 lo stesso testo lo farebbe leggere due volte. -->
            <img [src]="event().posterVerticalUrl" alt="" loading="lazy" />
          } @else {
            <span class="senza-locandina" aria-hidden="true">◆</span>
          }

          @if (event().availability?.soldOut) {
            <span class="www-chip www-chip-off stato">Esaurito</span>
          } @else if (onHold()) {
            <span class="www-chip www-chip-warn stato" [title]="holdTitle()">{{ holdLabel() }}</span>
          }
        </div>

        <div class="testo">
          <p class="tipo">
            <app-i18n-text [value]="event().eventType?.name" [showLanguage]="false" />
          </p>

          <h3 class="www-h3 titolo">
            <app-i18n-text [value]="event().title" />
          </h3>

          <p class="quando">{{ when() }}</p>
          <p class="dove">{{ where() }}</p>

          <p class="prezzo">
            @if (event().priceFrom === 0) {
              Ingresso gratuito disponibile
            } @else if (event().priceFrom !== null) {
              da {{ price() }}
            } @else {
              Prezzo su richiesta
            }
          </p>
        </div>
      </a>
    </article>
  `,
  styles: [
    `
      .scheda {
        height: 100%;
      }
      .tutto {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: rgb(var(--foreground-color));
        border: 1px solid rgba(var(--text-rgb), 0.14);
        border-radius: var(--www-radius);
        overflow: hidden;
        color: rgb(var(--text-rgb));
        text-decoration: none;
        transition:
          border-color 0.2s ease,
          transform 0.2s ease;
      }
      .tutto:hover {
        border-color: rgba(var(--accent-rgb), 0.6);
        transform: translateY(-2px);
      }
      /* Il focus da tastiera deve vedersi quanto il passaggio del mouse: qui il
         bersaglio e' l'intera scheda, e senza contorno non si capisce dove si e'. */
      .tutto:focus-visible {
        outline: 2px solid rgb(var(--accent-rgb));
        outline-offset: 2px;
      }

      .locandina {
        position: relative;
        /* 3:4, il formato della locandina verticale vera (le originali caricate
           sono 3000x4000). Il box e' fisso perche' e' cio' che tiene le schede
           allineate in griglia. */
        aspect-ratio: 3 / 4;
        background: rgba(var(--text-rgb), 0.06);
        overflow: hidden;
      }
      .locandina img {
        width: 100%;
        height: 100%;
        /* ⚠️ 'contain' e NON 'cover', ed e' la differenza fra mostrare una
           locandina e rovinarla.
           Le immagini caricate non hanno un formato unico: misurate il
           18/08/2026 vanno da 3:4 a 16:9 fino a una striscia 2.46:1. Con
           'cover' un box fisso ritaglia i lati, e su una locandina i lati sono
           testo: si e' visto «20 GIUGNO 2026» diventare «0 GIUGNO 2026» e
           «MILONGA GRATUITA» perdere la prima lettera.
           Nessun ritaglio fisso puo' andare bene per tutti quei formati. La
           locandina E' l'informazione, quindi si mostra intera e si accetta la
           banda vuota — che il fondo neutro sotto rende discreta. */
        object-fit: contain;
        display: block;
      }
      .senza-locandina {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgba(var(--accent-rgb), 0.5);
        font-size: 2.5rem;
      }
      .stato {
        position: absolute;
        left: 0.6rem;
        bottom: 0.6rem;
        /* La pastiglia sta SOPRA una fotografia, che puo' essere di qualunque
           colore: l'ombra e' cio' che la tiene leggibile su una locandina
           chiara come su una scura. */
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
      }

      .testo {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        padding: 0.75rem 0.85rem 0.85rem;
        flex: 1 1 auto;
      }
      .tipo {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgb(var(--accent-rgb));
        margin: 0;
      }
      .titolo {
        margin: 0.1rem 0 0.2rem;
        font-size: 1rem;
        line-height: 1.3;
        /* Due righe al massimo: un titolo lungo altrimenti sposta in basso date
           e luogo di una sola scheda, e la griglia perde l'allineamento. */
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .quando,
      .dove {
        margin: 0;
        font-size: 0.85rem;
        color: rgba(var(--text-rgb), 0.75);
      }
      .prezzo {
        margin: 0.5rem 0 0;
        font-size: 0.85rem;
        font-weight: 600;
      }
    `,
  ],
})
export class EventCardComponent {
  readonly event = input.required<PublicEventCard>();

  protected readonly when = computed(() => dateRange(this.event().startAt, this.event().endAt));

  /**
   * Città e regione: è la coppia che il ballerino usa per decidere se partire.
   *
   * Il **nome della location** non c'è più. In una bacheca la riga disponibile è
   * una, e «Palazzo delle Arti — Trani · Puglia» finisce troncata proprio sulla
   * parte che serve a decidere. Il nome resta nella scheda dell'evento, dove
   * serve davvero: a trovare la porta.
   */
  protected readonly where = computed(() => {
    const v = this.event().venue;
    return [v?.city, v?.region].filter(Boolean).join(' · ');
  });

  protected readonly price = computed(() => moneyShort(this.event().priceFrom));

  protected readonly onHold = computed(() => {
    const h = this.event().availability?.rolesOnHold;
    return !!h && (h.leader || h.follower);
  });

  protected readonly holdLabel = computed(() => {
    const h = this.event().availability?.rolesOnHold;
    if (!h) return '';
    if (h.leader && h.follower) return 'Iscrizioni in pausa';
    return h.leader ? 'Leader in attesa' : 'Follower in attesa';
  });

  protected readonly holdTitle = computed(
    () =>
      'Non è un esaurimento: l’organizzatore tiene in equilibrio i due ruoli e le ' +
      'iscrizioni di questo ruolo riaprono appena arrivano ballerini dell’altro.',
  );

  protected readonly title = computed(() => text(this.event().title));

  /**
   * L'etichetta del collegamento che avvolge la scheda.
   *
   * Serve perché il bersaglio cliccabile contiene un'immagine senza 'alt', un
   * titolo, due righe e un prezzo: letto in sequenza da uno screen reader
   * diventa un elenco di frammenti. Questa riga dice in una volta dove porta.
   */
  protected readonly etichetta = computed(() => {
    const parti = [this.title(), this.when(), this.where()].filter(Boolean);
    return parti.join(' — ');
  });
}
