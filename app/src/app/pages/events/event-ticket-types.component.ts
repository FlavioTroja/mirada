import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonComponent,
  CheckboxComponent,
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
  TextareaComponent,
} from '@keijo/ui';
import {
  add,
  check,
  close,
  copyAll,
  edit,
  euro,
  iconDelete,
  key,
  playlistAdd,
  priceChange,
  sell,
  star,
  warning,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  DANCE_ROLE_UI,
  DanceRole,
  SALE_UNIT_OPTIONS,
  SALE_UNIT_UI,
  SaleUnit,
  TICKET_TYPE_VISIBILITY_OPTIONS,
  TICKET_TYPE_VISIBILITY_UI,
  TicketTypeVisibility,
} from '../../core/domain/enums';
import { TicketType } from '../../core/domain/models';
import { centsToEuroInput, euroInputToCents, formatCents, toIso } from '../../core/i18n/format';
import { LocaleService, buildI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { EventStore } from '../../stores/event.store';
import { sessionsLabelOf } from './event-family';
import { TicketTypeStore } from '../../stores/ticket-type.store';
import { ConfirmService } from '../../shared/confirm.service';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { EventWorkspaceNavComponent } from './event-workspace-nav.component';
import { liveRefresh } from '../../core/realtime/live';
import { REALTIME_EVENTS } from '../../core/realtime/realtime.service';

/**
 * `/events/:id/ticket-types` — i **titoli d'ingresso** dell'evento (§4.2).
 *
 * «Titolo d'ingresso», mai «biglietto»: il biglietto è l'esemplare venduto (§1).
 *
 * Due vincoli che l'editor fa rispettare:
 *  - un titolo `PER_COUPLE` **non è acquistabile da solo**: senza un titolo per
 *    persona i ballerini singoli restano fuori (`T5`);
 *  - `roleConstraint` e `consumesRoleQuota = false` sono **incompatibili**: un
 *    titolo che non consuma quote di ruolo non può essere riservato a un ruolo.
 */
@Component({
  selector: 'app-event-ticket-types',
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
    TextareaComponent,
    SelectComponent,
    CheckboxComponent,
    DateTimePickerComponent,
    I18nTextComponent,
    StatusPillComponent,
    EventWorkspaceNavComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-event-workspace-nav [event]="eventStore.current()" current="ticket-types" />

      @if (store.coupleOnly()) {
        <keijo-page-section-wrapper mode="plain">
          <keijo-info-box [icon]="warningIcon" title="Nessun titolo per persona" variant="warning">
            <span>
              Tutti i titoli in vendita sono per coppia: chi si iscrive da solo non trova nulla da
              comprare. Aggiungi almeno un titolo per persona, oppure dichiara esplicitamente che
              l’evento accetta solo coppie.
            </span>
          </keijo-info-box>
        </keijo-page-section-wrapper>
      }

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica titolo d’ingresso' : 'Nuovo titolo d’ingresso'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.nameIt"
                label="nome (italiano)"
                id="ttNameIt"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.nameEn"
                label="nome (inglese)"
                id="ttNameEn"
                type="text"
              />
            </keijo-form-row>
            @if (err('nameIt'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.descriptionIt"
                label="descrizione (italiano)"
                id="ttDescIt"
                [rows]="3"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="3">
              <keijo-input
                [formControl]="form.controls.basePrice"
                label="prezzo base"
                id="basePrice"
                type="number"
                step="0.01"
                min="0"
                unitMeasure="€"
              />
              <keijo-select
                [formControl]="form.controls.saleUnit"
                [data]="saleUnitOptions"
                label="unità di vendita"
                placeholder="Per persona o per coppia"
              />
              <keijo-select
                [formControl]="form.controls.roleConstraint"
                [data]="roleOptions"
                label="vincolo di ruolo"
                placeholder="Nessun vincolo"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              Gli importi sono trattati in centesimi interi: qui li scrivi in euro, il sistema li
              conserva senza arrotondamenti.
            </p>

            <keijo-form-row [cols]="2">
              <keijo-checkbox
                [formControl]="form.controls.consumesRoleQuota"
                label="Consuma le quote di ruolo (leader / follower)"
              />
              <keijo-checkbox
                [formControl]="form.controls.highlighted"
                label="Metti in evidenza nella scheda pubblica"
              />
            </keijo-form-row>
            @if (roleConflict()) {
              <p class="mirada-error">
                Un titolo che non consuma quote di ruolo non può essere riservato a un ruolo:
                accompagnatori e spettatori non entrano nell’equilibrio leader/follower.
              </p>
            }

            <keijo-form-row [cols]="2">
              <keijo-datetime-picker
                [formControl]="form.controls.saleOpensAt"
                label="apertura vendita"
                id="saleOpensAt"
              />
              <keijo-datetime-picker
                [formControl]="form.controls.saleClosesAt"
                label="chiusura vendita"
                id="saleClosesAt"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="2">
              <keijo-select
                [formControl]="form.controls.visibility"
                [data]="visibilityOptions"
                label="visibilità"
                placeholder="Pubblico o con codice"
              />
              @if (form.controls.visibility.value === 'CODE_RESTRICTED') {
                <keijo-input
                  [formControl]="form.controls.accessCode"
                  label="codice di accesso"
                  id="accessCode"
                  type="text"
                />
              }
            </keijo-form-row>

            <keijo-form-row [cols]="3">
              <keijo-input
                [formControl]="form.controls.minPerOrder"
                label="minimo per ordine"
                id="minPerOrder"
                type="number"
                min="1"
              />
              <keijo-input
                [formControl]="form.controls.maxPerOrder"
                label="massimo per ordine"
                id="maxPerOrder"
                type="number"
                min="1"
              />
              <keijo-input
                [formControl]="form.controls.indicatedLevel"
                label="livello indicato"
                id="indicatedLevel"
                type="text"
              />
            </keijo-form-row>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (tt of store.items(); track tt.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title"><app-i18n-text [value]="tt.name" /></span>
                    <span class="mirada-muted">{{ price(tt) }}</span>
                  </div>
                </ng-template>

                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="saleUnitUi(tt.saleUnit)" />
                    <app-status-pill [status]="visibilityUi(tt.visibility)" />
                    @if (tt.roleConstraint) {
                      <app-status-pill [status]="roleUi(tt.roleConstraint)" />
                    }
                    @if (!tt.consumesRoleQuota) {
                      <keijo-pill
                        variant="default"
                        [icon]="quotaIcon"
                        tooltip="Non entra nell’equilibrio fra leader e follower"
                      >
                        fuori quote di ruolo
                      </keijo-pill>
                    }
                    @if (tt.highlighted) {
                      <keijo-pill variant="info" [icon]="highlightIcon">in evidenza</keijo-pill>
                    }
                    <keijo-pill variant="default" [icon]="quantityIcon">
                      {{ tt.minPerOrder }}–{{ tt.maxPerOrder }} per ordine
                    </keijo-pill>
                  </div>
                </ng-template>

                <ng-template #actions>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Elimina il titolo d’ingresso"
                      (action)="remove(tt)"
                    />
                    <keijo-button
                      variant="warning"
                      [icon]="editIcon"
                      tooltip="Modifica il titolo d’ingresso"
                      (action)="startEdit(tt)"
                    />
                    <keijo-button
                      variant="default"
                      [icon]="duplicateIcon"
                      tooltip="Duplica il titolo d’ingresso"
                      (action)="duplicate(tt)"
                    />
                  }
                  <keijo-button
                    variant="default"
                    [icon]="sessionsIcon"
                    [tooltip]="sessionsLabel() + ' incluse nel titolo'"
                    (action)="openSessions(tt)"
                  />
                  <keijo-button
                    variant="default"
                    [icon]="tiersIcon"
                    tooltip="Scaglioni di prezzo"
                    (action)="openTiers(tt)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="ticketIcon" title="Nessun titolo d’ingresso" variant="info">
                <span>
                  Il titolo d’ingresso è ciò che il ballerino compra: pass completo, ingresso a una
                  singola milonga, pacchetto di workshop. Ogni titolo porta l’elenco esplicito
                  delle sessioni che include.
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
        min-width: 0;
      }
      .title {
        font-weight: 600;
      }
      .secondary {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
    `,
  ],
})
export class EventTicketTypesComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);

  readonly store = inject(TicketTypeStore);
  readonly eventStore = inject(EventStore);

  /** «Lezioni» in un corso, «Sessioni» in un festival: la parola è del tipo. */
  readonly sessionsLabel = computed(() =>
    sessionsLabelOf(this.eventStore.current()?.eventType, this.locale.lang()),
  );

  readonly ticketIcon = sell;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;
  readonly duplicateIcon = copyAll;
  readonly sessionsIcon = playlistAdd;
  readonly tiersIcon = priceChange;
  readonly highlightIcon = star;
  readonly quotaIcon = key;
  readonly quantityIcon = euro;
  readonly warningIcon = warning;

  private readonly eventId = signal(0);
  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);

  readonly saleUnitOptions: SelectOption[] = SALE_UNIT_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));
  readonly visibilityOptions: SelectOption[] = TICKET_TYPE_VISIBILITY_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));
  readonly roleOptions: SelectOption[] = [
    { label: 'Nessun vincolo', value: null },
    { label: 'Solo leader', value: 'LEADER' },
    { label: 'Solo follower', value: 'FOLLOWER' },
  ];

  readonly canWrite = computed(() => this.auth.can().eventsWrite);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    nameIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nameEn: new FormControl('', { nonNullable: true }),
    descriptionIt: new FormControl('', { nonNullable: true }),
    basePrice: new FormControl<string>('0', { nonNullable: true }),
    saleUnit: new FormControl<SaleUnit>('PER_PERSON', { nonNullable: true }),
    roleConstraint: new FormControl<DanceRole | null>(null),
    consumesRoleQuota: new FormControl(true, { nonNullable: true }),
    saleOpensAt: new FormControl<Date | null>(null),
    saleClosesAt: new FormControl<Date | null>(null),
    visibility: new FormControl<TicketTypeVisibility>('PUBLIC', { nonNullable: true }),
    accessCode: new FormControl('', { nonNullable: true }),
    minPerOrder: new FormControl<number>(1, { nonNullable: true }),
    maxPerOrder: new FormControl<number>(10, { nonNullable: true }),
    indicatedLevel: new FormControl('', { nonNullable: true }),
    highlighted: new FormControl(false, { nonNullable: true }),
  });

  /** `roleConstraint` senza `consumesRoleQuota` è una configurazione impossibile. */
  roleConflict(): boolean {
    const value = this.form.getRawValue();
    return !!value.roleConstraint && !value.consumesRoleQuota;
  }

  constructor() {
    liveRefresh([REALTIME_EVENTS.availabilityChanged], () => this.store.load(), {
      eventId: () => this.eventId(),
      when: () => !this.form.dirty,
    });
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Titolo d’ingresso');
    this.eventId.set(Number(this.route.snapshot.paramMap.get('id')));
    this.registerActions();
    await Promise.all([
      this.eventStore.loadOne(this.eventId()),
      this.store.replaceQuery({ eventId: this.eventId() }),
    ]);
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite()) {
      actions.push({
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea un titolo d’ingresso',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  price(tt: TicketType): string {
    return formatCents(tt.basePrice);
  }

  saleUnitUi(unit: SaleUnit) {
    return SALE_UNIT_UI[unit];
  }
  visibilityUi(visibility: TicketTypeVisibility) {
    return TICKET_TYPE_VISIBILITY_UI[visibility];
  }
  roleUi(role: DanceRole) {
    return DANCE_ROLE_UI[role];
  }

  openSessions(tt: TicketType): void {
    void this.router.navigateByUrl(`/events/${this.eventId()}/ticket-types/${tt.id}/sessions`);
  }

  openTiers(tt: TicketType): void {
    void this.router.navigateByUrl(`/events/${this.eventId()}/ticket-types/${tt.id}/price-tiers`);
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      nameIt: '',
      nameEn: '',
      descriptionIt: '',
      basePrice: '0',
      saleUnit: 'PER_PERSON',
      roleConstraint: null,
      consumesRoleQuota: true,
      visibility: 'PUBLIC',
      accessCode: '',
      minPerOrder: 1,
      maxPerOrder: 10,
      indicatedLevel: '',
      highlighted: false,
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(tt: TicketType): void {
    this.editingId.set(tt.id);
    this.form.reset({
      nameIt: tt.name?.it ?? '',
      nameEn: tt.name?.en ?? '',
      descriptionIt: tt.description?.it ?? '',
      basePrice: centsToEuroInput(tt.basePrice),
      saleUnit: tt.saleUnit,
      roleConstraint: tt.roleConstraint ?? null,
      consumesRoleQuota: tt.consumesRoleQuota,
      saleOpensAt: tt.saleOpensAt ? new Date(tt.saleOpensAt) : null,
      saleClosesAt: tt.saleClosesAt ? new Date(tt.saleClosesAt) : null,
      visibility: tt.visibility,
      accessCode: tt.accessCode ?? '',
      minPerOrder: tt.minPerOrder,
      maxPerOrder: tt.maxPerOrder,
      indicatedLevel: tt.indicatedLevel ?? '',
      highlighted: tt.highlighted,
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  private buildPayload(): Record<string, unknown> | null {
    const value = this.form.getRawValue();
    if (value.roleConstraint && !value.consumesRoleQuota) {
      this.formErrors.set([
        'Un titolo che non consuma quote di ruolo non può essere riservato a un ruolo.',
      ]);
      return null;
    }
    return {
      eventId: this.eventId(),
      name: buildI18n(value.nameIt, value.nameEn),
      description: value.descriptionIt.trim() ? buildI18n(value.descriptionIt) : null,
      basePrice: euroInputToCents(value.basePrice),
      saleUnit: value.saleUnit,
      roleConstraint: value.roleConstraint ?? null,
      consumesRoleQuota: value.consumesRoleQuota,
      saleOpensAt: toIso(value.saleOpensAt),
      saleClosesAt: toIso(value.saleClosesAt),
      visibility: value.visibility,
      accessCode: value.visibility === 'CODE_RESTRICTED' ? value.accessCode.trim() || null : null,
      minPerOrder: Number(value.minPerOrder) || 1,
      maxPerOrder: Number(value.maxPerOrder) || 1,
      indicatedLevel: value.indicatedLevel.trim() || null,
      highlighted: value.highlighted,
      sortOrder: this.editingId() === null ? this.store.items().length : undefined,
    };
  }

  async onEditAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.editing.set(false);
      return;
    }
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);
    if (this.form.invalid) {
      this.formErrors.set(['Il nome del titolo è obbligatorio.']);
      return;
    }

    const payload = this.buildPayload();
    if (!payload) return;

    try {
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Titolo d’ingresso creato.');
      } else {
        const { eventId: _eventId, sortOrder: _sortOrder, ...patch } = payload;
        await this.store.update(id, patch);
        this.toast.show('SUCCESS', 'Titolo d’ingresso aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  /**
   * Duplicazione: il §3 non dichiara un endpoint dedicato per il titolo, quindi
   * è una normale creazione con gli stessi valori. Sessioni incluse e scaglioni
   * **non** vengono copiati: sono figli posseduti con il loro `PATCH`, e
   * copiarli in silenzio nasconderebbe una scelta all'organizzatore.
   */
  async duplicate(tt: TicketType): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Duplicare il titolo d’ingresso?',
      message:
        'Viene creata una copia con gli stessi prezzi e le stesse regole di vendita. ' +
        'Le sessioni incluse e gli scaglioni di prezzo non vengono copiati: li comporrai sul ' +
        'nuovo titolo, così la scelta resta esplicita.',
      confirmLabel: 'Duplica',
    });
    if (!ok) return;

    const name = i18nPlain(tt.name, this.locale.lang());
    await this.store.create({
      eventId: tt.eventId,
      name: buildI18n(`${tt.name?.it ?? name} (copia)`, tt.name?.en ? `${tt.name.en} (copy)` : ''),
      description: tt.description ?? null,
      basePrice: tt.basePrice,
      saleUnit: tt.saleUnit,
      roleConstraint: tt.roleConstraint ?? null,
      consumesRoleQuota: tt.consumesRoleQuota,
      saleOpensAt: tt.saleOpensAt ?? null,
      saleClosesAt: tt.saleClosesAt ?? null,
      visibility: tt.visibility,
      accessCode: tt.accessCode ?? null,
      minPerOrder: tt.minPerOrder,
      maxPerOrder: tt.maxPerOrder,
      indicatedLevel: tt.indicatedLevel ?? null,
      highlighted: false,
      sortOrder: this.store.items().length,
    });
    this.toast.show('SUCCESS', 'Titolo d’ingresso duplicato.');
    await this.store.load();
  }

  async remove(tt: TicketType): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare il titolo d’ingresso?',
      message:
        `«${i18nPlain(tt.name, this.locale.lang())}» sparisce dalla scheda pubblica. ` +
        'I biglietti già emessi su questo titolo restano validi: eliminare il titolo non li ' +
        'invalida.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(tt.id);
    this.toast.show('SUCCESS', 'Titolo d’ingresso eliminato.');
  }
}
