import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  EventAvailability,
  PublicTicketType,
  TicketTypeAvailability,
} from '../../core/domain/models';
import { SALE_UNIT_LABEL, dayLong, money, moneyShort } from '../../core/format/format';
import { I18nTextComponent } from '../../shared/i18n-text.component';

/**
 * I **titoli d'ingresso** (`TicketType`, §1: mai «biglietti» — quelli sono gli
 * esemplari venduti).
 *
 * Ogni titolo mostra lo **scaglione attivo e il criterio di scadenza reali**
 * (`RF-EVT-26`): «145 € — restano 60 posti a questo prezzo» oppure «fino al 30
 * aprile». I numeri arrivano da `POST /public/events/:id/availability`, che è
 * anche la sorgente del polling.
 *
 * `soldOut` e `roleOnHold` **non si confondono**: il primo è definitivo, il
 * secondo è un cancello di equilibrio che si riapre.
 */
@Component({
  selector: 'app-event-tickets',
  imports: [I18nTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="www-section" id="titoli">
      <h2 class="www-h2">Titoli d’ingresso</h2>
      <p class="www-muted">
        Il prezzo mostrato è quello dello scaglione attivo in questo momento; i diritti di
        prevendita, se dovuti, compaiono come voce separata al momento dell’iscrizione.
      </p>

      @if (imbalanceNote(); as note) {
        <p class="www-hint balance">{{ note }}</p>
      }

      <ul class="tickets">
        @for (tt of visible(); track tt.id) {
          <li class="ticket" [class.highlight]="tt.highlighted">
            <div class="ticket-head">
              <h3 class="www-h3">
                <app-i18n-text [value]="tt.name" />
              </h3>
              <div class="price">
                <span class="amount">{{ priceOf(tt) }}</span>
                <span class="unit">{{ unitOf(tt) }}</span>
              </div>
            </div>

            @if (tt.description) {
              <p class="descr"><app-i18n-text [value]="tt.description" /></p>
            }

            <div class="tags">
              @if (sessionsCount(tt) > 0) {
                <span class="www-chip">
                  {{ sessionsCount(tt) === 1 ? '1 sessione inclusa' : sessionsCount(tt) + ' sessioni incluse' }}
                </span>
              }
              @if (tt.indicatedLevel) {
                <span class="www-chip">{{ tt.indicatedLevel }}</span>
              }
              @if (tt.roleConstraint) {
                <span class="www-chip www-chip-accent">
                  riservato a {{ tt.roleConstraint === 'LEADER' ? 'leader' : 'follower' }}
                </span>
              }
              @if (tt.saleUnit === 'PER_COUPLE') {
                <span class="www-chip www-chip-accent">iscrizione in coppia</span>
              }
              @if (!tt.consumesRoleQuota) {
                <span class="www-chip" title="Non occupa un posto nelle quote di leader e follower">
                  non occupa posti di ruolo
                </span>
              }
            </div>

            @if (tierNote(tt); as note) {
              <p class="tier">{{ note }}</p>
            }

            <div class="state">
              @if (avail(tt); as a) {
                @if (a.soldOut) {
                  <span class="www-chip www-chip-off">Esaurito</span>
                  <span class="www-hint">
                    Il limite di capienza è stato raggiunto: è una situazione definitiva.
                  </span>
                } @else if (a.roleOnHold) {
                  <span class="www-chip www-chip-warn">{{ holdLabel(tt) }}</span>
                  <span class="www-hint">
                    Non è un esaurimento: le iscrizioni riaprono appena l’equilibrio fra i ruoli si
                    ricompone, oppure subito con un’iscrizione in coppia.
                  </span>
                } @else if (a.remaining !== null) {
                  <span class="www-chip www-chip-ok">{{ a.remaining }} posti disponibili</span>
                } @else {
                  <span class="www-chip www-chip-ok">Disponibile</span>
                }
              } @else {
                <span class="www-chip">Disponibilità in aggiornamento…</span>
              }

              <button
                type="button"
                class="www-btn"
                [disabled]="!selectable(tt)"
                (click)="choose.emit(tt.id)"
              >
                Iscriviti
              </button>
            </div>
          </li>
        }
      </ul>

      @if (hidden() > 0) {
        <p class="www-hint">
          {{ hidden() }} titoli sono riservati e si sbloccano con un codice fornito
          dall’organizzatore.
        </p>
      }
    </section>
  `,
  styles: [
    `
      .tickets {
        list-style: none;
        margin: 1rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.85rem;
      }
      .ticket {
        background: rgb(var(--foreground-color));
        border: 1px solid rgba(var(--text-rgb), 0.14);
        border-radius: var(--www-radius);
        padding: 1.1rem 1.2rem;
      }
      .ticket.highlight {
        border-color: rgba(var(--accent-rgb), 0.6);
      }
      .ticket-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .www-h3 {
        margin: 0;
      }
      .price {
        text-align: right;
        white-space: nowrap;
      }
      .amount {
        font-size: 1.35rem;
        font-weight: 600;
        color: rgb(var(--accent-rgb));
      }
      .unit {
        display: block;
        font-size: 0.75rem;
        color: rgba(var(--text-rgb), 0.65);
      }
      .descr {
        margin: 0.5rem 0 0;
        color: rgba(var(--text-rgb), 0.78);
        line-height: 1.55;
      }
      .tags {
        margin-top: 0.6rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .tier {
        margin: 0.6rem 0 0;
        font-size: 0.85rem;
        color: rgb(var(--accent-rgb));
      }
      .balance {
        margin-top: 0.75rem;
      }
      .state {
        margin-top: 0.85rem;
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
      }
      .state .www-btn {
        margin-left: auto;
      }
      .www-hint {
        flex: 1 1 18rem;
      }
    `,
  ],
})
export class EventTicketsComponent {
  readonly ticketTypes = input.required<PublicTicketType[]>();
  readonly availability = input<EventAvailability | null>(null);
  readonly choose = output<number>();

  /** I titoli a codice non compaiono in chiaro: `visibility = CODE_RESTRICTED`. */
  protected readonly visible = computed(() =>
    [...this.ticketTypes()]
      .filter((t) => t.visibility === 'PUBLIC')
      .sort((a, b) => Number(b.highlighted) - Number(a.highlighted) || a.sortOrder - b.sortOrder),
  );

  protected readonly hidden = computed(
    () => this.ticketTypes().filter((t) => t.visibility !== 'PUBLIC').length,
  );

  /** Lo sbilancio corrente con la tolleranza a fianco, quando è dichiarato. */
  protected readonly imbalanceNote = computed(() => {
    const a = this.availability();
    if (!a || a.imbalanceTolerance === null || a.imbalanceTolerance === undefined) return '';
    const gap = a.imbalance ?? 0;
    const dir = gap > 0 ? 'leader' : 'follower';
    const base =
      `Equilibrio dei ruoli: tolleranza ${a.imbalanceTolerance} posti` +
      (gap === 0 ? ', al momento in pari.' : `, oggi ${Math.abs(gap)} ${dir} in più.`);
    return `${base} Quando lo scarto raggiunge la tolleranza, il ruolo in eccesso va «in attesa» — che non vuol dire esaurito.`;
  });

  protected avail(tt: PublicTicketType): TicketTypeAvailability | null {
    return this.availability()?.ticketTypes?.find((t) => t.id === tt.id) ?? null;
  }

  protected selectable(tt: PublicTicketType): boolean {
    const a = this.avail(tt);
    // Senza disponibilità nota si lascia provare: l'impegno atomico della
    // capienza è comunque il server a farlo, e risponderebbe con il codice giusto.
    if (!a) return true;
    return !a.soldOut && !a.roleOnHold;
  }

  protected priceOf(tt: PublicTicketType): string {
    const tier = this.avail(tt)?.activeTier;
    const cents = tier?.price ?? tt.basePrice;
    return cents === 0 ? 'Gratuito' : moneyShort(cents);
  }

  protected unitOf(tt: PublicTicketType): string {
    return SALE_UNIT_LABEL[tt.saleUnit] ?? '';
  }

  protected sessionsCount(tt: PublicTicketType): number {
    return tt.sessions?.length ?? 0;
  }

  /** Il criterio di scadenza dello scaglione, **con i dati reali**. */
  protected tierNote(tt: PublicTicketType): string {
    const tier = this.avail(tt)?.activeTier;
    if (!tier) return '';
    const parts: string[] = [];
    if (tier.remainingAtThisPrice !== null && tier.remainingAtThisPrice !== undefined) {
      parts.push(
        tier.remainingAtThisPrice === 1
          ? 'resta 1 posto a questo prezzo'
          : `restano ${tier.remainingAtThisPrice} posti a questo prezzo`,
      );
    }
    if (tier.expiresAt) parts.push(`valido fino al ${dayLong(tier.expiresAt)}`);
    if (parts.length === 0) return '';
    const full = tt.basePrice > (tier.price ?? 0) ? ` — poi ${money(tt.basePrice)}` : '';
    return `${parts.join(', ')}${full}.`;
  }

  protected holdLabel(tt: PublicTicketType): string {
    const roles = this.availability()?.rolesOnHold;
    if (tt.roleConstraint) {
      return `Iscrizioni ${tt.roleConstraint === 'LEADER' ? 'leader' : 'follower'} in pausa`;
    }
    if (roles?.leader && roles?.follower) return 'Iscrizioni in pausa per entrambi i ruoli';
    if (roles?.leader) return 'Iscrizioni leader in pausa';
    if (roles?.follower) return 'Iscrizioni follower in pausa';
    return 'Iscrizioni in pausa per un ruolo';
  }
}
