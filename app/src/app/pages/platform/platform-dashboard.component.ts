import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  InfoBoxComponent,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  ListItemWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
} from '@keijo/ui';
import { celebration, domain, howToReg, payments, sell } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { ApiClient } from '../../core/api/api.client';
import {
  EVENT_STATUS_UI,
  ORGANIZATION_STATUS_UI,
  PAYOUT_STATUS_UI,
} from '../../core/domain/enums';
import { PlatformEventRow, PlatformOrganizationRow, PlatformSummary } from '../../core/domain/platform';
import { formatCents, formatDate } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { StatusPillComponent } from '../../shared/status-pill.component';

/**
 * `/platform` — **il cruscotto di chi gestisce la piattaforma**, su
 * `GET /platform/summary`.
 *
 * Non è il cruscotto d'evento in grande. Un organizzatore chiede «come va il mio
 * festival»; chi possiede il prodotto chiede «quanti clienti ho, chi vende, chi
 * è fermo, chi non può ancora incassare». Le due pagine condividono i numeri e
 * non l'intenzione, ed è per questo che sono due pagine.
 *
 * Vale anche qui `RB21`: le **iscrizioni** misurano l'impegnato, il **ricavo**
 * viene dai soli ordini saldati, e le due non si sommano. Il perimetro è
 * dichiarato in fondo, dove il backend lo scrive.
 */
@Component({
  selector: 'app-platform-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ListItemsWrapperComponent,
    ListItemWrapperComponent,
    ListItemsSkeletonComponent,
    PillComponent,
    InfoBoxComponent,
    StatusPillComponent,
  ],
  template: `
    <keijo-page-wrapper>
      @if (loading()) {
        <keijo-list-items-skeleton />
      } @else if (summary(); as data) {
        <!-- ------------------------------------------------- i numeri -->
        <keijo-page-section-wrapper title="La piattaforma">
          <div class="tiles">
            <div class="tile">
              <p class="mirada-label">Organizzatori</p>
              <p class="mirada-value big">{{ data.organizations.total }}</p>
              <p class="mirada-hint">{{ payoutLabel() }}</p>
            </div>
            <div class="tile">
              <p class="mirada-label">Eventi</p>
              <p class="mirada-value big">{{ data.events.total }}</p>
              <p class="mirada-hint">{{ eventsLabel() }}</p>
            </div>
            <div class="tile">
              <p class="mirada-label">Iscritti</p>
              <p class="mirada-value big">{{ data.registrations.total }}</p>
              <p class="mirada-hint">Iscrizioni attive su tutti gli eventi.</p>
            </div>
            <div class="tile">
              <p class="mirada-label">Ricavo della piattaforma</p>
              <p class="mirada-value big">{{ cents(data.revenue.presaleRights) }}</p>
              <p class="mirada-hint">
                Diritti di prevendita su {{ cents(data.revenue.total) }} transitati.
              </p>
            </div>
          </div>
          @if (!data.revenue.presaleRights && data.revenue.paidOrders) {
            <keijo-info-box [icon]="payoutIcon" title="La piattaforma non trattiene nulla" variant="warning">
              <span>
                Ci sono {{ data.revenue.paidOrders }} ordini saldati e i diritti di prevendita sono
                a zero: la tariffa non è ancora stata decisa. Finché resta così, ogni vendita passa
                interamente all’organizzatore.
              </span>
            </keijo-info-box>
          }
        </keijo-page-section-wrapper>

        <!-- --------------------------------------------- gli organizzatori -->
        <keijo-page-section-wrapper title="Organizzatori">
          @if (data.byOrganization.length) {
            <keijo-list-items-wrapper>
              @for (row of data.byOrganization; track row.organizationId) {
                <keijo-list-item-wrapper direction="row">
                  <div class="row" role="button" tabindex="0"
                       (click)="openOrganization(row)" (keydown.enter)="openOrganization(row)">
                    <div class="who">
                      <span class="mirada-value">{{ row.name }}</span>
                      <span class="mirada-hint">{{ ownersLabel(row) }}</span>
                    </div>
                    <app-status-pill [status]="orgStatusUi(row)" />
                    <app-status-pill [status]="payoutStatusUi(row)" />
                    <keijo-pill variant="default" [icon]="eventIcon">
                      {{ row.publishedEvents }} / {{ row.events }} pubblicati
                    </keijo-pill>
                    <keijo-pill variant="default" [icon]="registrationIcon">
                      {{ row.registrations }} iscritti
                    </keijo-pill>
                    <keijo-pill variant="success" [icon]="sellIcon">{{ cents(row.revenue) }}</keijo-pill>
                  </div>
                </keijo-list-item-wrapper>
              }
            </keijo-list-items-wrapper>
          } @else {
            <keijo-info-box [icon]="organizationIcon" title="Nessun organizzatore" variant="info">
              <span>
                La piattaforma non ha ancora clienti. Aprine uno da <strong>Organizzatori</strong>:
                indica chi ne sarà titolare e potrà amministrarlo subito.
              </span>
            </keijo-info-box>
          }
        </keijo-page-section-wrapper>

        <!-- ------------------------------------------------- tutti gli eventi -->
        <keijo-page-section-wrapper title="Tutti gli eventi">
          <p class="mirada-hint">
            Ogni evento di ogni organizzatore, il più imminente per primo. Gli iscritti sono
            l’<strong>impegnato</strong>: comprendono le prenotazioni in corso, che alla scadenza
            tornano disponibili.
          </p>
          @if (data.eventsList.length) {
            <keijo-list-items-wrapper>
              @for (ev of data.eventsList; track ev.eventId) {
                <keijo-list-item-wrapper direction="row">
                  <div class="row">
                    <div class="who">
                      <span class="mirada-value">{{ name(ev.title) }}</span>
                      <span class="mirada-hint">{{ ev.organizationName }} · {{ range(ev) }}</span>
                    </div>
                    <app-status-pill [status]="eventStatusUi(ev)" />
                    <keijo-pill variant="default" [icon]="registrationIcon">
                      {{ ev.registrations }} iscritti
                    </keijo-pill>
                  </div>
                </keijo-list-item-wrapper>
              }
            </keijo-list-items-wrapper>
          } @else {
            <p class="mirada-muted">Nessun evento è ancora stato costruito.</p>
          }
        </keijo-page-section-wrapper>

        <!-- ------------------------------------------------------ perimetro -->
        <keijo-page-section-wrapper title="Su cosa è calcolato">
          <p class="mirada-hint">{{ data.perimeter.note }}</p>
          @if (data.perimeter.missingEntities.length) {
            <div class="pills">
              <p class="mirada-label">Non ancora costruite</p>
              @for (entity of data.perimeter.missingEntities; track entity) {
                <keijo-pill variant="default" [icon]="organizationIcon">{{ entity }}</keijo-pill>
              }
            </div>
          }
          <p class="mirada-hint">Letto alle {{ readAt() }}.</p>
        </keijo-page-section-wrapper>
      } @else {
        <keijo-info-box [icon]="organizationIcon" title="Riepilogo non disponibile" variant="error">
          <span>{{ error() ?? 'Il riepilogo di piattaforma non è stato letto.' }}</span>
        </keijo-info-box>
      }
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
        gap: 0.75rem;
      }
      .tile {
        border: 1px solid rgba(var(--text-rgb), 0.12);
        border-radius: 0.5rem;
        padding: 0.625rem 0.75rem;
      }
      .big {
        font-size: 1.5rem;
        font-weight: 600;
        line-height: 1.2;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        cursor: default;
      }
      .who {
        display: flex;
        flex-direction: column;
        margin-right: auto;
      }
      .pills {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
        margin-top: 0.5rem;
      }
    `,
  ],
})
export class PlatformDashboardComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly locale = inject(LocaleService);

  readonly organizationIcon = domain;
  readonly eventIcon = celebration;
  readonly registrationIcon = howToReg;
  readonly sellIcon = sell;
  readonly payoutIcon = payments;

  readonly summary = signal<PlatformSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Piattaforma');
    try {
      this.summary.set(await this.api.fetch<PlatformSummary>('/platform/summary'));
    } catch (err) {
      this.error.set((err as Error)?.message ?? 'Lettura non riuscita.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Quante organizzazioni possono davvero incassare. È il numero che dice se la
   * piattaforma sta funzionando: un cliente approvato ma non collegato al
   * prestatore di pagamento non vende un biglietto.
   */
  readonly payoutLabel = computed(() => {
    const data = this.summary();
    if (!data) return '';
    const { total, payoutEnabled } = data.organizations;
    if (!total) return 'Nessun cliente.';
    if (payoutEnabled === total) return 'Tutti abilitati all’incasso.';
    return `${payoutEnabled} abilitati all’incasso, ${total - payoutEnabled} no.`;
  });

  readonly eventsLabel = computed(() => {
    const data = this.summary();
    if (!data) return '';
    const parts: string[] = [];
    if (data.events.running) parts.push(`${data.events.running} in corso`);
    if (data.events.upcoming) parts.push(`${data.events.upcoming} in programma`);
    return parts.length ? parts.join(', ') + '.' : 'Nessuno in calendario.';
  });

  readonly readAt = computed(() => {
    const data = this.summary();
    return data ? new Date(data.generatedAt).toLocaleTimeString('it-IT') : '—';
  });

  ownersLabel(row: PlatformOrganizationRow): string {
    if (!row.owners.length) return 'Nessun titolare — l’organizzazione non è amministrabile.';
    return row.owners.map((o) => o.fullName).join(', ');
  }

  orgStatusUi(row: PlatformOrganizationRow) {
    return ORGANIZATION_STATUS_UI[row.status];
  }

  payoutStatusUi(row: PlatformOrganizationRow) {
    return PAYOUT_STATUS_UI[row.payoutStatus];
  }

  eventStatusUi(ev: PlatformEventRow) {
    return EVENT_STATUS_UI[ev.status];
  }

  name(value: unknown): string {
    return i18nPlain(value as never, this.locale.lang()) || '—';
  }

  range(ev: PlatformEventRow): string {
    return `${formatDate(ev.startAt)} – ${formatDate(ev.endAt)}`;
  }

  cents(value: number): string {
    return formatCents(value);
  }

  /** La riga porta alla scheda del cliente: è il posto dove si interviene. */
  openOrganization(row: PlatformOrganizationRow): void {
    void this.router.navigate(['/platform/organizations'], {
      queryParams: { id: row.organizationId },
    });
  }
}
