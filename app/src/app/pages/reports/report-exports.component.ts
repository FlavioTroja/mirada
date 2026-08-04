import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonComponent,
  CheckboxComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import { checklist, download, euro, warning } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { EXPORT_KIND_UI, ExportKind } from '../../core/domain/dashboard';
import { MiradaEvent } from '../../core/domain/models';
import { formatDate } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { EventStore } from '../../stores/event.store';
import { ReportStore } from '../../stores/report.store';

/**
 * `/reports/exports` — generazione di un tracciato CSV con **scelta delle
 * colonne** (§4.7), su `POST /events/:id/exports` body `{ kind, columns[] }`.
 *
 * Le colonne ammesse sono un **elenco chiuso** del backend: il contratto non
 * espone un endpoint che le elenchi, quindi si imparano dall'esito della prima
 * generazione (che le restituisce) oppure dal `400` che le enumera quando una
 * colonna non è ammessa (`RB12`). Il frontend non le inventa.
 */
@Component({
  selector: 'app-report-exports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    FormWrapperComponent,
    FormRowComponent,
    SelectComponent,
    CheckboxComponent,
    ButtonComponent,
    PillComponent,
    InfoBoxComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <keijo-page-section-wrapper title="Cosa esportare">
        <keijo-form-wrapper>
          <keijo-form-row [cols]="2">
            <keijo-select
              [formControl]="eventControl"
              [data]="eventOptions()"
              label="evento"
              placeholder="Scegli l’evento"
            />
            <keijo-select
              [formControl]="kindControl"
              [data]="kindOptions"
              label="tipo di esportazione"
              placeholder="Scegli il tracciato"
            />
          </keijo-form-row>
        </keijo-form-wrapper>

        @if (kindDescription(); as text) {
          <p class="mirada-hint">{{ text }}</p>
        }

        @if (reason(); as text) {
          <keijo-info-box
            [icon]="warningIcon"
            title="Questa esportazione non è ancora producibile"
            variant="warning"
          >
            <span>{{ text }}</span>
          </keijo-info-box>
        }
      </keijo-page-section-wrapper>

      <keijo-page-section-wrapper title="Colonne">
        @if (columns().length) {
          <p class="mirada-hint">
            Le colonne ammesse arrivano dal contratto. Toglierne una restringe il tracciato; non se
            ne possono aggiungere di nuove, e nessuna di esse porta contatti oltre l’email del
            titolare, contenuto dei requisiti, diete o allergie.
          </p>
          <div class="columns">
            @for (item of columnControls(); track item.name) {
              <keijo-checkbox [formControl]="item.control" [label]="item.name" />
            }
          </div>
        } @else {
          <p class="mirada-hint">
            Il contratto non espone l’elenco delle colonne ammesse: si conosce dopo la prima
            generazione, che lo restituisce. Genera una volta con tutte le colonne, poi torna qui
            per restringerlo.
          </p>
        }
      </keijo-page-section-wrapper>

      <keijo-page-section-wrapper title="Esito">
        <div class="row">
          <keijo-button
            variant="accent"
            [icon]="exportIcon"
            label="Genera CSV"
            [disabled]="store.generating() || !eventControl.value"
            [loading]="store.generating()"
            tooltip="Genera il tracciato con le colonne selezionate"
            (action)="generate()"
          />
          @if (last(); as done) {
            <keijo-button
              variant="default"
              [icon]="downloadIcon"
              label="Scarica"
              tooltip="Scarica il tracciato appena generato"
              (action)="open(done.fileUrl)"
            />
          }
        </div>

        @if (store.rejected(); as rejected) {
          <p class="mirada-error">{{ rejected.message }}</p>
        }

        @if (last(); as done) {
          <div class="row">
            <keijo-pill variant="success" [icon]="checkIcon">{{ done.rows }} righe</keijo-pill>
            <keijo-pill variant="default" [icon]="checkIcon">
              {{ done.columns.length }} colonne
            </keijo-pill>
          </div>
          <p class="mirada-hint">Calcolato su: {{ done.basedOn.join(', ') }}.</p>
        }
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
      .columns {
        display: grid;
        gap: 0.25rem;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      }
    `,
  ],
})
export class ReportExportsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly locale = inject(LocaleService);
  private readonly events = inject(EventStore);

  readonly store = inject(ReportStore);

  readonly exportIcon = euro;
  readonly downloadIcon = download;
  readonly checkIcon = checklist;
  readonly warningIcon = warning;

  readonly eventControl = new FormControl<number | null>(null);
  readonly kindControl = new FormControl<ExportKind>('REGISTRATIONS', { nonNullable: true });

  private readonly selectable = signal<MiradaEvent[]>([]);
  private readonly controls = new Map<string, FormControl<boolean>>();

  /**
   * Un interruttore per colonna ammessa. Costruito in un `effect`, **mai in
   * template**: creare o scrivere stato durante il rendering è `NG0600`.
   */
  readonly columnControls = signal<{ name: string; control: FormControl<boolean> }[]>([]);

  readonly kindOptions: SelectOption[] = EXPORT_KIND_UI.map((k) => ({
    label: k.label,
    value: k.kind,
  }));

  readonly eventOptions = computed<SelectOption[]>(() =>
    this.selectable().map((ev) => ({
      label: `${i18nPlain(ev.title, this.locale.lang())} — ${formatDate(ev.startAt)}`,
      value: ev.id,
    })),
  );

  readonly kindDescription = computed(
    () => EXPORT_KIND_UI.find((k) => k.kind === this.kindControl.value)?.description ?? '',
  );

  private readonly kind = signal<ExportKind>('REGISTRATIONS');

  readonly columns = computed(() => this.store.columnsFor(this.kind()));
  readonly reason = computed(() => this.store.reasonFor(this.kind()));
  readonly last = computed(
    () => this.store.results().find((r) => r.kind === this.kind()) ?? null,
  );

  constructor() {
    this.kindControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.kind.set(value);
      this.store.clearRejection();
    });

    effect(() => {
      const kind = this.kind();
      const columns = this.columns();
      this.columnControls.set(
        columns.map((name) => {
          const key = `${kind}:${name}`;
          let control = this.controls.get(key);
          if (!control) {
            control = new FormControl(true, { nonNullable: true });
            this.controls.set(key, control);
          }
          return { name, control };
        }),
      );
    });
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Esportazioni');
    this.pageActions.set([]);

    const events = await this.events.loadAll({}, 100, '');
    const sorted = [...events].sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    );
    this.selectable.set(sorted);

    const params = this.route.snapshot.queryParamMap;
    const eventId = Number(params.get('eventId'));
    const kind = params.get('kind') as ExportKind | null;
    this.eventControl.setValue(
      Number.isFinite(eventId) && eventId > 0 ? eventId : (sorted[0]?.id ?? null),
    );
    if (kind) {
      this.kindControl.setValue(kind);
      this.kind.set(kind);
    }
  }

  /** Una colonna deselezionata esce dal tracciato; nessuna si può aggiungere. */
  columnControl(column: string): FormControl<boolean> | null {
    return this.controls.get(`${this.kind()}:${column}`) ?? null;
  }

  private selectedColumns(): string[] {
    const all = this.columnControls();
    if (!all.length) return [];
    const chosen = all.filter((item) => item.control.value).map((item) => item.name);
    // Tutte selezionate = nessun filtro: si lascia decidere al backend.
    return chosen.length === all.length ? [] : chosen;
  }

  async generate(): Promise<void> {
    const id = this.eventControl.value;
    if (id == null) return;
    const result = await this.store.generate(id, this.kind(), this.selectedColumns());
    if (result) this.toast.show('SUCCESS', `Esportazione generata: ${result.rows} righe.`);
  }

  open(url: string): void {
    window.open(url, '_blank', 'noopener');
  }
}
