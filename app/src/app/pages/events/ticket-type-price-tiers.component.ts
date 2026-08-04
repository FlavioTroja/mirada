import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonComponent,
  DateTimePickerComponent,
  EntityListItemComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import {
  add,
  check,
  close,
  edit,
  iconDelete,
  numbers,
  priceChange,
  save,
  schedule,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  PRICE_TIER_KIND_OPTIONS,
  PRICE_TIER_KIND_UI,
  PriceTierKind,
} from '../../core/domain/enums';
import { PricePreview, PriceTier } from '../../core/domain/models';
import {
  centsToEuroInput,
  euroInputToCents,
  formatCents,
  formatDateTime,
  toIso,
} from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { EventStore } from '../../stores/event.store';
import { TicketTypeStore } from '../../stores/ticket-type.store';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { controlError } from '../../shared/form-errors';
import { EventWorkspaceNavComponent } from './event-workspace-nav.component';

/**
 * `/events/:id/ticket-types/:ttId/price-tiers` — scaglioni di prezzo (§4.2).
 *
 * Figlio posseduto: si salva con **un solo `PATCH
 * /ticket-types/:id/price-tiers`** che porta l'array intero. `soldQuantity` è
 * calcolato dal server e non viene mai inviato.
 *
 * L'anteprima di prezzo usa `POST /ticket-types/:id/price-preview`, che
 * restituisce lo scaglione attivo con **dati reali** (`RF-EVT-26`).
 */
@Component({
  selector: 'app-ticket-type-price-tiers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ListItemsWrapperComponent,
    ListItemsSkeletonComponent,
    EntityListItemComponent,
    ButtonComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    SelectComponent,
    DateTimePickerComponent,
    StatusPillComponent,
    EventWorkspaceNavComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-event-workspace-nav [event]="eventStore.current()" current="ticket-types" />

      <keijo-page-section-wrapper [title]="'Scaglioni di ' + ticketTypeName()">
        <p class="mirada-hint">
          Gli scaglioni sostituiscono il prezzo base quando sono attivi. Il prezzo di listino del
          titolo è {{ basePrice() }}; qui sotto l’anteprima dice quale prezzo pagherebbe adesso
          chi comprasse, con dati reali.
        </p>
        @if (preview(); as p) {
          <div class="preview">
            <keijo-pill variant="success" [icon]="previewIcon">
              prezzo attivo {{ formatPrice(p.price) }}
            </keijo-pill>
            @if (p.expiresAt) {
              <keijo-pill variant="warning" [icon]="scheduleIcon">
                valido fino al {{ formatWhen(p.expiresAt) }}
              </keijo-pill>
            }
            @if (p.remainingAtThisPrice !== null && p.remainingAtThisPrice !== undefined) {
              <keijo-pill variant="info" [icon]="quantityIcon">
                {{ p.remainingAtThisPrice }} ancora a questo prezzo
              </keijo-pill>
            }
          </div>
        }
      </keijo-page-section-wrapper>

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingIndex() === null ? 'Nuovo scaglione' : 'Modifica scaglione'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-select
                [formControl]="form.controls.kind"
                [data]="kindOptions"
                label="tipo di scaglione"
                placeholder="A data, a quantità, combinato"
              />
              <keijo-input
                [formControl]="form.controls.price"
                label="prezzo"
                id="tierPrice"
                type="number"
                step="0.01"
                min="0"
                unitMeasure="€"
              />
            </keijo-form-row>
            @if (err('price'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="2">
              <keijo-datetime-picker
                [formControl]="form.controls.validUntil"
                label="valido fino a"
                id="validUntil"
              />
              <keijo-input
                [formControl]="form.controls.maxQuantity"
                label="quantità massima"
                id="maxQuantity"
                type="number"
                min="0"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              Uno scaglione a data usa «valido fino a»; uno a quantità usa la quantità massima; il
              combinato scade al primo dei due che si esaurisce.
            </p>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (tier of tiers(); track $index) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title">{{ formatPrice(tier.price) }}</span>
                    <span class="mirada-muted">{{ describe(tier) }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="kindUi(tier.kind)" />
                    @if (tier.maxQuantity) {
                      <keijo-pill variant="default" [icon]="quantityIcon">
                        {{ tier.soldQuantity ?? 0 }}/{{ tier.maxQuantity }} venduti
                      </keijo-pill>
                    }
                    @if (tier.validUntil) {
                      <keijo-pill variant="default" [icon]="scheduleIcon">
                        fino al {{ formatWhen(tier.validUntil) }}
                      </keijo-pill>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Elimina lo scaglione"
                      (action)="removeTier($index)"
                    />
                    <keijo-button
                      variant="warning"
                      [icon]="editIcon"
                      tooltip="Modifica lo scaglione"
                      (action)="startEdit($index)"
                    />
                  }
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="tierIcon" title="Nessuno scaglione" variant="info">
                <span>
                  Senza scaglioni vale il prezzo base del titolo. Gli scaglioni servono a fare
                  early bird a data, a quantità o combinati.
                </span>
              </keijo-info-box>
            }
          </keijo-list-items-wrapper>
        }
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .primary {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
      }
      .title {
        font-weight: 600;
      }
      .secondary,
      .preview {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
    `,
  ],
})
export class TicketTypePriceTiersComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly ticketTypes = inject(TicketTypeStore);

  readonly eventStore = inject(EventStore);

  readonly tierIcon = priceChange;
  readonly previewIcon = priceChange;
  readonly scheduleIcon = schedule;
  readonly quantityIcon = numbers;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  private readonly eventId = signal(0);
  private readonly ticketTypeId = signal(0);
  readonly loading = signal(true);
  readonly tiers = signal<PriceTier[]>([]);
  /** Righe rimosse in questa sessione di editing: viaggiano con `toBeDisconnected`. */
  private readonly removed = signal<PriceTier[]>([]);
  readonly editing = signal(false);
  readonly editingIndex = signal<number | null>(null);
  readonly preview = signal<PricePreview | null>(null);

  readonly kindOptions: SelectOption[] = PRICE_TIER_KIND_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));

  readonly canWrite = computed(() => this.auth.can().eventsWrite);

  readonly ticketTypeName = computed(() =>
    i18nPlain(this.ticketTypes.current()?.name, this.locale.lang(), 'questo titolo'),
  );

  readonly basePrice = computed(() => formatCents(this.ticketTypes.current()?.basePrice));

  readonly editButtons: SectionActionButton[] = [
    { id: 'apply', icon: check, label: 'Applica', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    kind: new FormControl<PriceTierKind>('BY_DATE', { nonNullable: true }),
    price: new FormControl<string>('0', { nonNullable: true, validators: [Validators.required] }),
    validUntil: new FormControl<Date | null>(null),
    maxQuantity: new FormControl<string>('', { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Scaglioni di prezzo');
    this.eventId.set(Number(this.route.snapshot.paramMap.get('id')));
    this.ticketTypeId.set(Number(this.route.snapshot.paramMap.get('ttId')));
    this.registerActions();

    const [, ticketType] = await Promise.all([
      this.eventStore.loadOne(this.eventId()),
      this.ticketTypes.loadOne(this.ticketTypeId(), 'priceTiers'),
    ]);
    this.tiers.set([...(ticketType.priceTiers ?? [])]);
    this.loading.set(false);
    await this.loadPreview();
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite()) {
      actions.push({
        id: 'save',
        icon: save,
        label: 'Salva',
        tooltip: 'Salva gli scaglioni di prezzo',
        run: () => void this.save(),
      });
      actions.push({
        id: 'add',
        icon: add,
        label: 'Aggiungi',
        tooltip: 'Aggiungi uno scaglione',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  private async loadPreview(): Promise<void> {
    try {
      this.preview.set(await this.ticketTypes.pricePreview(this.ticketTypeId()));
    } catch {
      this.preview.set(null);
    }
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  formatPrice(cents: number): string {
    return formatCents(cents);
  }

  formatWhen(value: string | null | undefined): string {
    return formatDateTime(value);
  }

  kindUi(kind: PriceTierKind) {
    return PRICE_TIER_KIND_UI[kind];
  }

  describe(tier: PriceTier): string {
    if (tier.kind === 'BY_QUANTITY') return `Primi ${tier.maxQuantity ?? '—'} biglietti`;
    if (tier.kind === 'BY_DATE') return `Fino al ${formatDateTime(tier.validUntil)}`;
    return `Fino al ${formatDateTime(tier.validUntil)} o ai primi ${tier.maxQuantity ?? '—'}`;
  }

  startCreate(): void {
    this.editingIndex.set(null);
    this.form.reset({ kind: 'BY_DATE', price: '0', maxQuantity: '' });
    this.editing.set(true);
  }

  startEdit(index: number): void {
    const tier = this.tiers()[index];
    this.editingIndex.set(index);
    this.form.reset({
      kind: tier.kind,
      price: centsToEuroInput(tier.price),
      validUntil: tier.validUntil ? new Date(tier.validUntil) : null,
      maxQuantity: tier.maxQuantity ? String(tier.maxQuantity) : '',
    });
    this.editing.set(true);
  }

  onEditAction(button: SectionActionButton): void {
    if (button.id === 'cancel') {
      this.editing.set(false);
      return;
    }
    const value = this.form.getRawValue();
    const row: PriceTier = {
      id: -1,
      kind: value.kind,
      price: euroInputToCents(value.price),
      validUntil: toIso(value.validUntil),
      maxQuantity: value.maxQuantity ? Number(value.maxQuantity) : null,
      sortOrder: this.tiers().length,
    };

    const index = this.editingIndex();
    if (index === null) {
      this.tiers.update((rows) => [...rows, row]);
    } else {
      this.tiers.update((rows) =>
        rows.map((existing, i) =>
          i === index ? { ...row, id: existing.id, sortOrder: existing.sortOrder ?? i } : existing,
        ),
      );
    }
    this.editing.set(false);
  }

  removeTier(index: number): void {
    const tier = this.tiers()[index];
    if (tier.id > 0) this.removed.update((rows) => [...rows, tier]);
    this.tiers.update((rows) => rows.filter((_, i) => i !== index));
  }

  /**
   * Un solo `PATCH` con l'array intero. `soldQuantity` non viene mai inviato:
   * lo muove il server (§3.6).
   */
  async save(): Promise<void> {
    const rows = [
      ...this.tiers().map((tier, index) => ({
        id: tier.id > 0 ? tier.id : -1,
        kind: tier.kind,
        price: tier.price,
        validUntil: tier.validUntil ?? null,
        maxQuantity: tier.maxQuantity ?? null,
        sortOrder: index,
      })),
      ...this.removed().map((tier) => ({
        id: tier.id,
        kind: tier.kind,
        price: tier.price,
        validUntil: tier.validUntil ?? null,
        maxQuantity: tier.maxQuantity ?? null,
        toBeDisconnected: true,
      })),
    ];

    await this.ticketTypes.savePriceTiers(this.ticketTypeId(), rows as PriceTier[]);
    const refreshed = await this.ticketTypes.loadOne(this.ticketTypeId(), 'priceTiers');
    this.tiers.set([...(refreshed.priceTiers ?? [])]);
    this.removed.set([]);
    this.toast.show('SUCCESS', 'Scaglioni di prezzo salvati.');
    await this.loadPreview();
  }
}
