import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PublicEvent } from '../../core/domain/models';
import { dayTime, money } from '../../core/format/format';
import { I18nTextComponent } from '../../shared/i18n-text.component';

/**
 * Location, requisiti di partecipazione, servizi accessori, policy di rimborso e
 * organizzatore: tutto ciò che il §3.7 promette nella scheda pubblica e che
 * decide se un ballerino prenota il treno.
 */
@Component({
  selector: 'app-event-info',
  imports: [I18nTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="www-section" id="informazioni">
      <h2 class="www-h2">Informazioni pratiche</h2>

      <div class="cards">
        <!-- Location -->
        <div class="www-panel">
          <h3 class="www-h3">Location</h3>
          <p class="line strong">{{ event().venue.name }}</p>
          @if (address(); as a) {
            <p class="line">{{ a }}</p>
          }
          <ul class="features">
            @if (event().venue.capacity) {
              <li>Capienza dichiarata: {{ event().venue.capacity }}</li>
            }
            @if (event().venue.airConditioning) {
              <li>Aria condizionata</li>
            }
            @if (event().venue.parking) {
              <li>Parcheggio</li>
            }
            @if (event().venue.accessibility) {
              <li>Accessibilità: {{ event().venue.accessibility }}</li>
            }
          </ul>
          @if (event().venue.notes) {
            <p class="line www-muted">{{ event().venue.notes }}</p>
          }
        </div>

        <!-- Organizzatore -->
        <div class="www-panel">
          <h3 class="www-h3">Organizzatore</h3>
          <p class="line strong">{{ event().organization.name }}</p>
          @if (event().organization.legalName) {
            <p class="line www-muted">{{ event().organization.legalName }}</p>
          }
          @if (event().organization.contactEmail) {
            <p class="line">
              <a [href]="'mailto:' + event().organization.contactEmail">
                {{ event().organization.contactEmail }}
              </a>
            </p>
          }
          @if (event().organization.website) {
            <p class="line">
              <a [href]="event().organization.website" target="_blank" rel="noopener">
                {{ event().organization.website }}
              </a>
            </p>
          }
          <p class="www-hint">
            L’iscrizione è un contratto con l’organizzatore: la piattaforma è lo strumento di
            vendita e rilascia una conferma d’ordine con QR di accesso, mai un titolo fiscale.
          </p>
        </div>

        <!-- Requisiti -->
        <div class="www-panel">
          <h3 class="www-h3">Requisiti di partecipazione</h3>
          @if (event().requirements.length) {
            <ul class="reqs">
              @for (r of event().requirements; track r.id) {
                <li>
                  <span class="req-label"><app-i18n-text [value]="r.label" /></span>
                  <span class="www-chip" [class.www-chip-warn]="r.blocking === 'PURCHASE'">
                    {{ blockingLabel(r.blocking) }}
                  </span>
                  @if (r.mandatory) {
                    <span class="www-chip www-chip-accent">obbligatorio</span>
                  }
                  <span class="req-text"><app-i18n-text [value]="r.text" /></span>
                  @if (r.dueAt) {
                    <span class="www-hint">Da fornire entro il {{ when(r.dueAt) }}</span>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="www-muted">
              L’organizzatore non ha dichiarato requisiti di partecipazione per questo evento.
            </p>
          }

          <p class="line">
            <strong>Minori:</strong>
            {{ event().minorsAdmitted ? 'ammessi' : 'non ammessi' }}
            @if (event().minorsConditions) {
              — <app-i18n-text [value]="event().minorsConditions" />
            }
          </p>
        </div>

        <!-- Servizi accessori -->
        @if (event().services.length) {
          <div class="www-panel">
            <h3 class="www-h3">Servizi accessori</h3>
            <ul class="services">
              @for (s of event().services; track s.id) {
                <li>
                  <span><app-i18n-text [value]="s.name" /></span>
                  <span class="price">{{ money(s.price) }}</span>
                  @if (s.description) {
                    <span class="www-muted"><app-i18n-text [value]="s.description" /></span>
                  }
                </li>
              }
            </ul>
          </div>
        }

        <!-- Rimborsi -->
        <div class="www-panel">
          <h3 class="www-h3">Rimborsi e trasferimento</h3>
          <p class="line"><app-i18n-text [value]="event().refundPolicyText" emptyLabel="L’organizzatore non ha pubblicato una politica di rimborso." /></p>
          @if (salesClose(); as sc) {
            <p class="www-hint">{{ sc }}</p>
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
        gap: 0.85rem;
        margin-top: 1rem;
      }
      /* La classe .www-panel porta un margine verticale perché di norma è un
         blocco impilato. Qui però è una **cella di griglia**: i margini dei
         figli di una griglia non collassano e si sommerebbero al gap,
         allargando solo le righe e lasciando invariate le colonne — le schede
         risulterebbero distanziate in un verso e serrate nell'altro. La
         spaziatura è della griglia, e resta sua. */
      .cards > .www-panel {
        margin: 0;
      }
      .www-h3 {
        margin-bottom: 0.6rem;
      }
      .line {
        margin: 0 0 0.35rem;
        line-height: 1.55;
        color: rgba(var(--text-rgb), 0.82);
      }
      .line.strong {
        color: rgb(var(--text-rgb));
        font-weight: 600;
      }
      .line a {
        color: rgb(var(--accent-rgb));
      }
      .features,
      .reqs,
      .services {
        list-style: none;
        margin: 0.5rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.4rem;
        color: rgba(var(--text-rgb), 0.78);
        font-size: 0.9rem;
      }
      .reqs li {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        align-items: baseline;
        padding-bottom: 0.4rem;
        border-bottom: 1px solid rgba(var(--text-rgb), 0.08);
      }
      .req-label {
        font-weight: 600;
        color: rgb(var(--text-rgb));
      }
      .req-text {
        flex: 1 1 100%;
      }
      .services li {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .services .price {
        margin-left: auto;
        color: rgb(var(--accent-rgb));
      }
    `,
  ],
})
export class EventInfoComponent {
  readonly event = input.required<PublicEvent>();

  protected readonly money = money;

  protected readonly address = computed(() => {
    const a = this.event().venue.address;
    if (!a) return '';
    const street = [a.address, a.number].filter(Boolean).join(' ');
    const town = [a.zipCode, a.city].filter(Boolean).join(' ');
    const area = [a.province ? `(${a.province})` : '', a.region].filter(Boolean).join(' ');
    return [street, town, area, a.country].filter(Boolean).join(' — ');
  });

  /** I criteri di chiusura vendita, detti in italiano e non per sigla. */
  protected readonly salesClose = computed(() => {
    const e = this.event();
    const bits: string[] = [];
    if (e.salesCloseCriteria?.includes('DATE') && e.salesCloseAt) {
      bits.push(`le iscrizioni online chiudono il ${dayTime(e.salesCloseAt)}`);
    }
    if (e.salesCloseCriteria?.includes('QUOTA_EXHAUSTED')) {
      bits.push('o prima, all’esaurimento dei posti');
    }
    if (e.salesCloseCriteria?.includes('EVENT_START')) bits.push('e comunque all’inizio dell’evento');
    return bits.length ? `${bits.join(', ')}.` : '';
  });

  protected when(iso: string): string {
    return dayTime(iso);
  }

  protected blockingLabel(blocking: string): string {
    switch (blocking) {
      case 'PURCHASE':
        return 'necessario per iscriversi';
      case 'ENTRY':
        return 'necessario per entrare in sala';
      default:
        return 'informativo';
    }
  }
}
