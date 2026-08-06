import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicEventCard } from '../../core/domain/models';
import { dateRange, moneyShort, text } from '../../core/format/format';
import { I18nTextComponent } from '../../shared/i18n-text.component';

/**
 * La scheda breve di un evento nei risultati di ricerca.
 *
 * Mostra: locandina, titolo, date, **città e regione**, tipo evento, «da € …» e
 * la disponibilità sintetica. Se l'evento è esaurito lo **dichiara**, invece di
 * lasciarlo dedurre da un numero mancante.
 */
@Component({
  selector: 'app-event-card',
  imports: [RouterLink, I18nTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <a class="poster" [routerLink]="['/eventi', event().slug]" tabindex="-1" aria-hidden="true">
        @if (event().posterVerticalUrl) {
          <img [src]="event().posterVerticalUrl" [alt]="" loading="lazy" />
        } @else {
          <span class="poster-empty">◆</span>
        }
      </a>

      <div class="body">
        <p class="kind">
          <app-i18n-text [value]="event().eventType?.name" [showLanguage]="false" />
        </p>

        <h3 class="www-h3">
          <a [routerLink]="['/eventi', event().slug]">
            <app-i18n-text [value]="event().title" />
          </a>
        </h3>

        <p class="when">{{ when() }}</p>
        <p class="where">{{ where() }}</p>

        <div class="foot">
          <span class="price">
            @if (event().priceFrom === 0) {
              Ingresso gratuito disponibile
            } @else if (event().priceFrom !== null) {
              da {{ price() }}
            } @else {
              Prezzo su richiesta
            }
          </span>

          @if (event().availability?.soldOut) {
            <span class="www-chip www-chip-off">Esaurito</span>
          } @else if (onHold()) {
            <span class="www-chip www-chip-warn" [title]="holdTitle()">{{ holdLabel() }}</span>
          } @else if (remaining() !== null) {
            <span class="www-chip www-chip-ok">{{ remaining() }} posti disponibili</span>
          } @else {
            <span class="www-chip">Iscrizioni aperte</span>
          }
        </div>

        @if (roleCounts()) {
          <p class="roles">{{ roleCounts() }}</p>
        }
      </div>
    </article>
  `,
  styles: [
    `
      .card {
        display: grid;
        grid-template-columns: 8.5rem 1fr;
        gap: 1rem;
        background: rgb(var(--foreground-color));
        border: 1px solid rgba(var(--text-rgb), 0.14);
        border-radius: var(--www-radius);
        overflow: hidden;
        height: 100%;
        transition: border-color 0.2s ease;
      }
      .card:hover {
        border-color: rgba(var(--accent-rgb), 0.6);
      }
      .poster {
        display: block;
        background: rgba(var(--text-rgb), 0.06);
      }
      .poster img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .poster-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgba(var(--accent-rgb), 0.5);
        font-size: 2rem;
      }
      .body {
        padding: 0.9rem 1rem 1rem 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .kind {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgb(var(--accent-rgb));
        margin: 0;
      }
      .www-h3 {
        margin: 0.1rem 0 0.2rem;
        font-size: 1.1rem;
      }
      .www-h3 a {
        color: rgb(var(--text-rgb));
        text-decoration: none;
      }
      .www-h3 a:hover {
        text-decoration: underline;
      }
      .when,
      .where {
        margin: 0;
        font-size: 0.88rem;
        color: rgba(var(--text-rgb), 0.75);
      }
      .foot {
        margin-top: auto;
        padding-top: 0.6rem;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
      }
      .price {
        font-weight: 600;
        color: rgb(var(--text-rgb));
      }
      .roles {
        margin: 0.35rem 0 0;
        font-size: 0.78rem;
        color: rgba(var(--text-rgb), 0.62);
      }
      @media (max-width: 520px) {
        .card {
          grid-template-columns: 6rem 1fr;
        }
      }
    `,
  ],
})
export class EventCardComponent {
  readonly event = input.required<PublicEventCard>();

  protected readonly when = computed(() => dateRange(this.event().startAt, this.event().endAt));

  /** Città e regione: è la coppia che il ballerino usa per decidere se partire. */
  protected readonly where = computed(() => {
    const v = this.event().venue;
    const parts = [v?.city, v?.region].filter(Boolean);
    const place = parts.join(' · ');
    return v?.name ? `${v.name}${place ? ' — ' + place : ''}` : place;
  });

  protected readonly price = computed(() => moneyShort(this.event().priceFrom));

  protected readonly remaining = computed(() => this.event().availability?.remaining ?? null);

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

  protected readonly roleCounts = computed(() => {
    const roles = this.event().availability?.roles;
    if (!roles) return '';
    const l = roles.leader;
    const f = roles.follower;
    if (l === null && f === null) return '';
    return `Posti per ruolo — leader: ${l ?? '—'} · follower: ${f ?? '—'}`;
  });

  protected readonly title = computed(() => text(this.event().title));
}
