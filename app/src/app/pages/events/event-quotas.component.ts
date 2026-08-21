import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonComponent,
  CheckboxComponent,
  EntityListItemComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  LabeledProgressComponent,
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
  eventSeat,
  iconDelete,
  lock,
  scale,
  visibility,
  warning,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  DANCE_ROLE_UI,
  DanceRole,
  QUOTA_RESERVED_FOR_OPTIONS,
  QUOTA_RESERVED_FOR_UI,
  QUOTA_SCOPE_OPTIONS,
  QUOTA_SCOPE_UI,
  QuotaReservedFor,
  QuotaScope,
} from '../../core/domain/enums';
import { CapacityQuota } from '../../core/domain/models';
import { formatImbalance } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { CapacityQuotaStore } from '../../stores/capacity-quota.store';
import { EventServiceStore } from '../../stores/event-service.store';
import { EventStore } from '../../stores/event.store';
import { SessionStore } from '../../stores/session.store';
import { TicketTypeStore } from '../../stores/ticket-type.store';
import { VenueStore } from '../../stores/venue.store';
import { ConfirmService } from '../../shared/confirm.service';
import { DomainErrorComponent } from '../../shared/domain-error.component';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { EventWorkspaceNavComponent } from './event-workspace-nav.component';
import { liveRefresh } from '../../core/realtime/live';
import { REALTIME_EVENTS } from '../../core/realtime/realtime.service';

/**
 * `/events/:id/quotas` — le **quote di capienza** dell'evento (§4.2).
 *
 * Regole che l'editor rende visibili invece di nasconderle:
 *  - sulla quota di capienza della sala (`scope=EVENT`, nessun ruolo) e sulle
 *    quote di ruolo di ambito evento, `sforamento ammesso` e `limitante` sono
 *    **mostrati e disabilitati**: è un vincolo di sicurezza, non una scelta
 *    commerciale;
 *  - `tolleranza sbilancio` si valorizza **solo sulle quote di ruolo appaiate
 *    dello stesso ambito**, e le due devono essere coerenti;
 *  - `consumato` è calcolato dal server e non è mai modificabile qui.
 */
@Component({
  selector: 'app-event-quotas',
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
    LabeledProgressComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    SelectComponent,
    CheckboxComponent,
    StatusPillComponent,
    DomainErrorComponent,
    EventWorkspaceNavComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-event-workspace-nav [event]="eventStore.current()" current="quotas" />
      <app-domain-error />

      @if (store.roleBalance(); as balance) {
        <keijo-page-section-wrapper title="Equilibrio dei ruoli">
          <div class="balance">
            <keijo-labeled-progress
              [icon]="leaderIcon"
              label="Leader"
              [current]="balance.leaders"
              [total]="leaderLimit()"
              color="accent"
            />
            <keijo-labeled-progress
              [icon]="followerIcon"
              label="Follower"
              [current]="balance.followers"
              [total]="followerLimit()"
              color="accent"
            />
          </div>
          <p class="mirada-value">
            Sbilancio corrente: {{ imbalanceLabel(balance) }}
          </p>
          <p class="mirada-hint">
            Quando lo sbilancio raggiunge la tolleranza, il ruolo in eccesso passa
            <strong>in attesa</strong>, non «esaurito»: le iscrizioni riprendono appena il ruolo
            opposto recupera, o subito con un’iscrizione in coppia.
          </p>
        </keijo-page-section-wrapper>
      }

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica quota di capienza' : 'Nuova quota di capienza'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="3">
              <keijo-select
                [formControl]="form.controls.scope"
                [data]="scopeOptions"
                label="ambito"
                placeholder="Evento, sessione, titolo, servizio"
              />
              @if (form.controls.scope.value !== 'EVENT') {
                <keijo-select
                  [formControl]="form.controls.scopeId"
                  [data]="scopeTargetOptions()"
                  label="oggetto"
                  placeholder="Scegli l’oggetto della quota"
                />
              }
              <keijo-select
                [formControl]="form.controls.role"
                [data]="roleOptions()"
                label="ruolo"
                placeholder="Indifferente al ruolo"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              Il ruolo è valorizzabile solo sulle quote di ambito evento o sessione: le quote di
              titolo e di servizio contano persone, non ruoli di ballo.
            </p>

            <keijo-form-row [cols]="3">
              <keijo-input
                [formControl]="form.controls.limit"
                label="limite"
                id="quotaLimit"
                type="number"
                min="0"
              />
              <keijo-input
                [formControl]="form.controls.overbookAllowance"
                label="sforamento ammesso"
                id="overbook"
                type="number"
                min="0"
              />
              <keijo-input
                [formControl]="form.controls.imbalanceTolerance"
                label="tolleranza sbilancio"
                id="tolerance"
                type="number"
                min="0"
              />
            </keijo-form-row>
            @if (safetyLocked()) {
              <p class="mirada-hint">
                Su questa quota lo sforamento è forzato a zero e la quota è sempre limitante: è la
                capienza fisica della sala, un vincolo di sicurezza. I due campi restano visibili
                per non nascondere la regola, ma non sono modificabili.
              </p>
            }

            <keijo-form-row [cols]="2">
              <keijo-select
                [formControl]="form.controls.reservedFor"
                [data]="reservedForOptions"
                label="riservata a"
                placeholder="Vendita ordinaria"
              />
              <keijo-checkbox
                [formControl]="form.controls.publiclyVisible"
                label="Mostra la disponibilità residua nella scheda pubblica"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="1">
              <keijo-checkbox
                [formControl]="form.controls.limiting"
                label="Quota limitante (blocca la vendita al raggiungimento del limite)"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              Una quota non limitante conta i posti ma non blocca: è il caso delle milonghe
              incluse in un pass, dove non esiste un posto assegnato e la sala assorbe.
            </p>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (quota of store.items(); track quota.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title">{{ describeTarget(quota) }}</span>
                    <span class="mirada-muted">
                      {{ quota.consumed }} su {{ quota.limit }} — residuo {{ remaining(quota) }}
                    </span>
                  </div>
                </ng-template>

                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="scopeUi(quota.scope)" />
                    @if (quota.role) {
                      <app-status-pill [status]="roleUi(quota.role)" />
                    }
                    @if (quota.reservedFor) {
                      <app-status-pill [status]="reservedUi(quota.reservedFor)" />
                    }
                    @if (quota.limiting) {
                      <keijo-pill
                        variant="warning"
                        [icon]="limitingIcon"
                        tooltip="Al raggiungimento del limite la vendita si blocca"
                      >
                        limitante
                      </keijo-pill>
                    } @else {
                      <keijo-pill
                        variant="default"
                        [icon]="seatIcon"
                        tooltip="Conta i posti ma non blocca la vendita"
                      >
                        non limitante
                      </keijo-pill>
                    }
                    @if (quota.overbookAllowance > 0) {
                      <keijo-pill variant="default" [icon]="balanceIcon">
                        sforamento {{ quota.overbookAllowance }}
                      </keijo-pill>
                    }
                    @if (quota.imbalanceTolerance) {
                      <keijo-pill variant="default" [icon]="balanceIcon">
                        tolleranza {{ quota.imbalanceTolerance }}
                      </keijo-pill>
                    }
                    @if (quota.publiclyVisible) {
                      <keijo-pill variant="default" [icon]="publicIcon">visibile al pubblico</keijo-pill>
                    }
                  </div>
                </ng-template>

                <ng-template #actions>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Elimina la quota"
                      (action)="remove(quota)"
                    />
                    <keijo-button
                      variant="warning"
                      [icon]="editIcon"
                      tooltip="Modifica la quota"
                      (action)="startEdit(quota)"
                    />
                  }
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="seatIcon" title="Nessuna quota di capienza" variant="info">
                <span>
                  Senza quote non c’è alcun vincolo di capienza: l’evento vende all’infinito.
                  @if (venueCapacity()) {
                    La location dichiara una capienza di {{ venueCapacity() }} posti: è il valore
                    proposto per la quota della sala, mai imposto.
                  }
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
      .secondary {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
      .balance {
        display: grid;
        gap: 0.5rem;
      }
    `,
  ],
})
export class EventQuotasComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly sessions = inject(SessionStore);
  private readonly ticketTypes = inject(TicketTypeStore);
  private readonly services = inject(EventServiceStore);
  private readonly venues = inject(VenueStore);

  readonly store = inject(CapacityQuotaStore);
  readonly eventStore = inject(EventStore);

  readonly seatIcon = eventSeat;
  readonly balanceIcon = scale;
  readonly limitingIcon = lock;
  readonly publicIcon = visibility;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;
  readonly warningIcon = warning;
  readonly leaderIcon = DANCE_ROLE_UI.LEADER.icon;
  readonly followerIcon = DANCE_ROLE_UI.FOLLOWER.icon;

  private readonly eventId = signal(0);
  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly venueCapacity = signal<number | null>(null);

  private readonly sessionOptions = signal<SelectOption[]>([]);
  private readonly ticketTypeOptions = signal<SelectOption[]>([]);
  private readonly serviceOptions = signal<SelectOption[]>([]);

  readonly scopeOptions: SelectOption[] = QUOTA_SCOPE_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));
  readonly reservedForOptions: SelectOption[] = QUOTA_RESERVED_FOR_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value || null,
  }));

  readonly canWrite = computed(() => this.auth.can().eventsWrite);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    scope: new FormControl<QuotaScope>('EVENT', { nonNullable: true }),
    scopeId: new FormControl<number | null>(null),
    role: new FormControl<DanceRole | null>(null),
    limit: new FormControl<string>('0', { nonNullable: true, validators: [Validators.required] }),
    overbookAllowance: new FormControl<string>('0', { nonNullable: true }),
    imbalanceTolerance: new FormControl<string>('', { nonNullable: true }),
    limiting: new FormControl(true, { nonNullable: true }),
    reservedFor: new FormControl<QuotaReservedFor | null>(null),
    publiclyVisible: new FormControl(true, { nonNullable: true }),
  });

  readonly leaderLimit = computed(() => this.store.leaderQuota()?.limit ?? 0);
  readonly followerLimit = computed(() => this.store.followerQuota()?.limit ?? 0);

  constructor() {
    // I contatori `consumed` di questa pagina sono gli stessi che si muovono a
    // ogni vendita e a ogni ingresso: guardarli fermi mentre l'evento vende e
    // il caso in cui una pagina mente. La guardia sul modulo evita di
    // cancellare sotto le dita di chi sta modificando un limite.
    liveRefresh([REALTIME_EVENTS.availabilityChanged], () => this.store.load(), {
      eventId: () => this.eventId(),
      when: () => !this.form.dirty,
    });
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Quota di capienza');
    this.eventId.set(Number(this.route.snapshot.paramMap.get('id')));
    this.registerActions();

    const [ev] = await Promise.all([
      this.eventStore.loadOne(this.eventId()),
      this.store.replaceQuery({ eventId: this.eventId() }),
      this.loadTargets(),
    ]);

    if (ev.venueId) {
      try {
        const venue = await this.venues.loadOne(ev.venueId);
        this.venueCapacity.set(venue.capacity ?? null);
      } catch {
        this.venueCapacity.set(null);
      }
    }
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite()) {
      actions.push({
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea una quota di capienza',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  private async loadTargets(): Promise<void> {
    const lang = this.locale.lang();
    const [sessions, ticketTypes, services] = await Promise.all([
      this.sessions.loadAll({ eventId: this.eventId() }, 300, ''),
      this.ticketTypes.loadAll({ eventId: this.eventId() }, 300, ''),
      this.services.loadAll({ eventId: this.eventId() }, 300, ''),
    ]);
    this.sessionOptions.set(sessions.map((s) => ({ label: i18nPlain(s.name, lang), value: s.id })));
    this.ticketTypeOptions.set(
      ticketTypes.map((t) => ({ label: i18nPlain(t.name, lang), value: t.id })),
    );
    this.serviceOptions.set(services.map((s) => ({ label: i18nPlain(s.name, lang), value: s.id })));
  }

  scopeTargetOptions(): SelectOption[] {
    switch (this.form.controls.scope.value) {
      case 'SESSION':
        return this.sessionOptions();
      case 'TICKET_TYPE':
        return this.ticketTypeOptions();
      case 'SERVICE':
        return this.serviceOptions();
      default:
        return [];
    }
  }

  /** Il ruolo si valorizza **solo** su ambito `EVENT` o `SESSION` (§3.6). */
  roleOptions(): SelectOption[] {
    const scope = this.form.controls.scope.value;
    if (scope !== 'EVENT' && scope !== 'SESSION') {
      return [{ label: 'Non applicabile a questo ambito', value: null }];
    }
    return [
      { label: 'Indifferente al ruolo', value: null },
      { label: 'Leader', value: 'LEADER' },
      { label: 'Follower', value: 'FOLLOWER' },
    ];
  }

  /** Capienza della sala e quote di ruolo di ambito evento: vincolo di sicurezza. */
  safetyLocked(): boolean {
    const value = this.form.getRawValue();
    return value.scope === 'EVENT' && !value.reservedFor;
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  remaining(quota: CapacityQuota): number {
    return CapacityQuotaStore.remaining(quota);
  }

  scopeUi(scope: QuotaScope) {
    return QUOTA_SCOPE_UI[scope];
  }
  roleUi(role: DanceRole) {
    return DANCE_ROLE_UI[role];
  }
  reservedUi(reserved: QuotaReservedFor) {
    return QUOTA_RESERVED_FOR_UI[reserved];
  }

  imbalanceLabel(balance: { leaders: number; followers: number; tolerance: number | null }): string {
    return formatImbalance(balance.leaders, balance.followers, balance.tolerance);
  }

  describeTarget(quota: CapacityQuota): string {
    const label = QUOTA_SCOPE_UI[quota.scope].label;
    if (quota.scope === 'EVENT') {
      return quota.role
        ? `Capienza dell’evento — ${DANCE_ROLE_UI[quota.role].label}`
        : 'Capienza della sala';
    }
    const options =
      quota.scope === 'SESSION'
        ? this.sessionOptions()
        : quota.scope === 'TICKET_TYPE'
          ? this.ticketTypeOptions()
          : this.serviceOptions();
    const target = options.find((o) => o.value === quota.scopeId);
    return `${label} — ${target?.label ?? '#' + quota.scopeId}`;
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      scope: 'EVENT',
      scopeId: null,
      role: null,
      limit: this.venueCapacity() ? String(this.venueCapacity()) : '0',
      overbookAllowance: '0',
      imbalanceTolerance: '',
      limiting: true,
      reservedFor: null,
      publiclyVisible: true,
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(quota: CapacityQuota): void {
    this.editingId.set(quota.id);
    this.form.reset({
      scope: quota.scope,
      scopeId: quota.scopeId ?? null,
      role: quota.role ?? null,
      limit: String(quota.limit),
      overbookAllowance: String(quota.overbookAllowance),
      imbalanceTolerance: quota.imbalanceTolerance ? String(quota.imbalanceTolerance) : '',
      limiting: quota.limiting,
      reservedFor: quota.reservedFor ?? null,
      publiclyVisible: quota.publiclyVisible,
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  async onEditAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.editing.set(false);
      return;
    }
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);

    const value = this.form.getRawValue();
    const errors: string[] = [];
    if (value.scope !== 'EVENT' && !value.scopeId) {
      errors.push('Le quote di sessione, titolo e servizio devono indicare l’oggetto.');
    }
    if (value.role && value.scope !== 'EVENT' && value.scope !== 'SESSION') {
      errors.push('Il ruolo è ammesso solo sulle quote di ambito evento o sessione.');
    }
    if (value.imbalanceTolerance && !value.role) {
      errors.push('La tolleranza di sbilancio vale solo sulle quote di ruolo appaiate.');
    }
    if (errors.length) {
      this.formErrors.set(errors);
      return;
    }

    const safety = this.safetyLocked();
    const payload = {
      eventId: this.eventId(),
      scope: value.scope,
      scopeId: value.scope === 'EVENT' ? null : Number(value.scopeId),
      role: value.role ?? null,
      limit: Number(value.limit) || 0,
      // Sulla quota della sala lo sforamento è forzato a 0 e `limiting` a true.
      overbookAllowance: safety ? 0 : Number(value.overbookAllowance) || 0,
      limiting: safety ? true : value.limiting,
      reservedFor: value.reservedFor ?? null,
      imbalanceTolerance: value.imbalanceTolerance ? Number(value.imbalanceTolerance) : null,
      publiclyVisible: value.publiclyVisible,
    };

    try {
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Quota di capienza creata.');
      } else {
        const { eventId: _e, scope: _s, scopeId: _sid, ...patch } = payload;
        await this.store.update(id, patch);
        this.toast.show('SUCCESS', 'Quota di capienza aggiornata.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(quota: CapacityQuota): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare la quota di capienza?',
      message:
        'Senza questa quota il vincolo sparisce e la vendita non è più limitata su questo ambito. ' +
        `Al momento risultano ${quota.consumed} posti impegnati: eliminandola non vengono ` +
        'rilasciati né annullati, semplicemente smettono di essere confrontati con un limite.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(quota.id);
    this.toast.show('SUCCESS', 'Quota di capienza eliminata.');
  }
}
