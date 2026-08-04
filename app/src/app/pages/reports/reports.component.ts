import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  ButtonComponent,
  InfoBoxComponent,
  ListItemsWrapperComponent,
  ListItemWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import { celebration, download, euro, summarize, sync, warning } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { EXPORT_KIND_UI, ExportKind, unavailableOf } from '../../core/domain/dashboard';
import { MiradaEvent } from '../../core/domain/models';
import { formatDate } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { DashboardStore } from '../../stores/dashboard.store';
import { EventStore } from '../../stores/event.store';
import { ReportStore } from '../../stores/report.store';
import { UnavailableSectionComponent } from '../../shared/unavailable-section.component';

/**
 * `/reports` — riepilogo economico dell'evento ed esportazioni (§4.7).
 *
 * **Ogni report dichiara su quali dati è calcolato** (`RB21`). Il riepilogo
 * economico vive nella sezione `netRevenue` di `GET /events/:id/dashboard`: se
 * il backend la dichiara non calcolabile, qui compare il motivo, **non uno
 * zero**. Un netto a zero quando gli ordini non esistono non è un riepilogo
 * prudente: è un dato falso.
 *
 * Le esportazioni passano da `POST /events/:id/exports`. Un `kind` che dipende
 * da entità non ancora costruite risponde **`501` con il motivo esplicito**:
 * si mostra quello, mai un tracciato vuoto che sembrerebbe un dato.
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    SelectComponent,
    PillComponent,
    ButtonComponent,
    InfoBoxComponent,
    ListItemsWrapperComponent,
    ListItemWrapperComponent,
    UnavailableSectionComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <keijo-page-section-wrapper title="Evento">
        <keijo-select
          [formControl]="eventControl"
          [data]="eventOptions()"
          label="evento"
          placeholder="Scegli l’evento da rendicontare"
        />
        @if (selectedEvent(); as ev) {
          <div class="row">
            <keijo-pill variant="default" [icon]="eventIcon">{{ range(ev) }}</keijo-pill>
            @if (!ev.manageExternalChannels) {
              <keijo-pill
                variant="info"
                [icon]="warningIcon"
                tooltip="L’evento non gestisce canali di vendita esterni"
              >
                solo vendite online
              </keijo-pill>
            }
          </div>
        } @else if (!eventOptions().length) {
          <keijo-info-box [icon]="eventIcon" title="Nessun evento da rendicontare" variant="info">
            <span>Senza un evento non c’è nulla da riepilogare né da esportare.</span>
          </keijo-info-box>
        }
      </keijo-page-section-wrapper>

      <!-- ------------------------------------------ riepilogo economico -->
      <keijo-page-section-wrapper title="Riepilogo economico">
        @if (netRevenueUnavailable(); as info) {
          <app-unavailable-section label="Riepilogo economico" [section]="info" />
          <p class="mirada-hint">
            Incassato per metodo, rimborsato, netto, diritti di prevendita maturati e incasso alla
            porta sono tutte grandezze di ordini e pagamenti. Finché quelle entità non esistono,
            mostrarle a zero direbbe una cosa falsa.
          </p>
        } @else if (dashboard.data()) {
          <p class="mirada-hint">
            Il backend dichiara la sezione calcolabile: la sua forma non è ancora descritta nel §3
            e questa pagina va aggiornata quando lo sarà.
          </p>
        } @else {
          <p class="mirada-hint">Scegli un evento per leggere il riepilogo.</p>
        }
      </keijo-page-section-wrapper>

      <!-- --------------------------------------------- esportazioni ----->
      <keijo-page-section-wrapper title="Esportazioni">
        <p class="mirada-hint">
          Le colonne sono un <strong>elenco chiuso</strong> deciso dal contratto: non contengono
          contatti oltre l’email del titolare, né contenuto dei requisiti, né diete o allergie.
        </p>

        <keijo-list-items-wrapper>
          @for (item of kinds; track item.kind) {
            <keijo-list-item-wrapper direction="column">
              <div class="export">
                <div class="export-head">
                  <span class="mirada-value">{{ item.label }}</span>
                  @if (store.reasonFor(item.kind)) {
                    <keijo-pill
                      variant="warning"
                      [icon]="warningIcon"
                      tooltip="Non producibile: il contratto lo dichiara, i dati non esistono ancora"
                    >
                      non ancora producibile
                    </keijo-pill>
                  }
                  @if (lastFor(item.kind); as done) {
                    <keijo-pill variant="success" [icon]="downloadIcon">
                      {{ done.rows }} righe
                    </keijo-pill>
                  }
                </div>
                <p class="mirada-hint">{{ item.description }}</p>

                @if (store.reasonFor(item.kind); as reason) {
                  <p class="mirada-hint reason">{{ reason }}</p>
                }

                @if (lastFor(item.kind); as done) {
                  <p class="mirada-hint">
                    Calcolato su: {{ done.basedOn.join(', ') }} · colonne:
                    {{ done.columns.join(', ') }}
                  </p>
                }

                <div class="row">
                  <keijo-button
                    variant="accent"
                    [icon]="exportIcon"
                    label="Genera"
                    [disabled]="store.generating() || !eventControl.value"
                    [loading]="store.generating()"
                    tooltip="Genera il tracciato CSV con tutte le colonne ammesse"
                    (action)="generate(item.kind)"
                  />
                  @if (lastFor(item.kind); as done) {
                    <keijo-button
                      variant="default"
                      [icon]="downloadIcon"
                      label="Scarica"
                      tooltip="Scarica l’ultimo tracciato generato"
                      (action)="open(done.fileUrl)"
                    />
                  }
                  @if (columnsKnown(item.kind)) {
                    <keijo-button
                      variant="default"
                      [icon]="summarizeIcon"
                      label="Scegli colonne"
                      tooltip="Scegli quali colonne includere"
                      (action)="openColumns(item.kind)"
                    />
                  }
                </div>
              </div>
            </keijo-list-item-wrapper>
          }
        </keijo-list-items-wrapper>

        @if (store.rejected(); as rejected) {
          <p class="mirada-error">{{ rejected.message }}</p>
        }
      </keijo-page-section-wrapper>

      <!-- ------------------------------------------ liste operative ----->
      <keijo-page-section-wrapper title="Liste operative">
        <keijo-info-box [icon]="warningIcon" title="Non ancora producibili" variant="warning">
          <span>
            Elenco per ruolo, elenco pasti <strong>con diete</strong>, elenco taglie ed elenco slot
            si costruiscono sugli esiti dei requisiti (<strong>RequirementOutcome</strong>) e sui
            servizi acquistati, che vivono su <strong>OrderLine</strong>. Nessuna delle due entità
            è ancora costruita. Sono anche l’unico posto in cui diete e allergie possono comparire:
            non finiranno mai nelle esportazioni generiche.
          </span>
        </keijo-info-box>
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .row,
      .export-head {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
      .export {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        width: 100%;
      }
      .reason {
        border-left: 2px solid var(--color-warning);
        padding-left: 0.5rem;
      }
    `,
  ],
})
export class ReportsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly locale = inject(LocaleService);
  private readonly events = inject(EventStore);

  readonly store = inject(ReportStore);
  readonly dashboard = inject(DashboardStore);

  readonly eventIcon = celebration;
  readonly warningIcon = warning;
  readonly exportIcon = euro;
  readonly downloadIcon = download;
  readonly summarizeIcon = summarize;

  readonly kinds = EXPORT_KIND_UI;

  readonly eventControl = new FormControl<number | null>(null);
  private readonly selectable = signal<MiradaEvent[]>([]);

  readonly eventOptions = computed<SelectOption[]>(() =>
    this.selectable().map((ev) => ({
      label: `${i18nPlain(ev.title, this.locale.lang())} — ${formatDate(ev.startAt)}`,
      value: ev.id,
    })),
  );

  readonly selectedEvent = computed(
    () => this.selectable().find((ev) => ev.id === this.eventControl.value) ?? null,
  );

  /** Il riepilogo economico è la sezione `netRevenue` del cruscotto (§4.7). */
  readonly netRevenueUnavailable = computed(() =>
    unavailableOf(this.dashboard.section<Record<string, unknown>>('netRevenue')),
  );

  constructor() {
    this.eventControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      if (id != null) void this.select(id);
    });
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Report');
    this.registerActions();
    const events = await this.events.loadAll({}, 100, '');
    const sorted = [...events].sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    );
    this.selectable.set(sorted);
    if (sorted.length) this.eventControl.setValue(sorted[0].id, { emitEvent: true });
  }

  private async select(eventId: number): Promise<void> {
    try {
      await this.dashboard.load(eventId);
    } catch {
      /* il riepilogo resta senza dichiarazione: nessuno zero inventato */
    }
    // `SALES_BY_SESSION` va **dichiarato** indisponibile senza che
    // l'organizzatore debba scoprirlo provando: è una delle tre condizioni che
    // reggono il posizionamento fiscale, e nasconderlo lo farebbe dimenticare.
    await this.store.probe(eventId, 'SALES_BY_SESSION');
  }

  private registerActions(): void {
    const actions: PageAction[] = [
      {
        id: 'exports',
        icon: summarize,
        label: 'Esporta',
        tooltip: 'Apri la generazione di un’esportazione con scelta delle colonne',
        run: () => void this.openColumns(null),
      },
      {
        id: 'refresh',
        icon: sync,
        tooltip: 'Rileggi il riepilogo',
        run: () => {
          const id = this.eventControl.value;
          if (id != null) void this.select(id);
        },
      },
    ];
    this.pageActions.set(actions);
  }

  lastFor(kind: ExportKind) {
    return this.store.results().find((r) => r.kind === kind) ?? null;
  }

  columnsKnown(kind: ExportKind): boolean {
    return this.store.columnsFor(kind).length > 0;
  }

  async generate(kind: ExportKind): Promise<void> {
    const id = this.eventControl.value;
    if (id == null) return;
    const result = await this.store.generate(id, kind);
    if (result) this.toast.show('SUCCESS', `Esportazione generata: ${result.rows} righe.`);
  }

  open(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  openColumns(kind: ExportKind | null): void {
    const id = this.eventControl.value;
    if (id == null) return;
    void this.router.navigate(['/reports/exports'], {
      queryParams: { eventId: id, ...(kind ? { kind } : {}) },
    });
  }

  range(ev: MiradaEvent): string {
    return `${formatDate(ev.startAt)} – ${formatDate(ev.endAt)}`;
  }
}
