import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';
import {
  ButtonComponent,
  CheckboxComponent,
  EntityListItemComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  KeijoFilterChange,
  KeijoFilterOption,
  KeijoFilterTab,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PaginationComponent,
  PillComponent,
  SearchBarComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import {
  add,
  check,
  close,
  handshake,
  heartBroken,
  howToReg,
  swapHoriz,
  sync,
  visibility,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  DANCE_ROLE_UI,
  DECLARED_DANCE_ROLE_OPTIONS,
  DECLARED_DANCE_ROLE_UI,
  DanceRole,
  DeclaredDanceRole,
  REGISTRATION_CHANNEL_OPTIONS,
  REGISTRATION_CHANNEL_UI,
  REGISTRATION_STATUS_OPTIONS,
  REGISTRATION_STATUS_UI,
  RegistrationChannel,
  RegistrationStatus,
} from '../../core/domain/enums';
import { Registration } from '../../core/domain/models';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { CoupleStore } from '../../stores/couple.store';
import { EventStore } from '../../stores/event.store';
import { RegistrationStore } from '../../stores/registration.store';
import { ConfirmService } from '../../shared/confirm.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { DomainErrorComponent } from '../../shared/domain-error.component';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';

/**
 * `/registrations` — gli **iscritti** (§4.3).
 *
 * «Iscrizione» è la *persona* nell'evento, non il titolo economico (§1).
 *
 * Il **ruolo dichiarato** e il **ruolo assegnato** sono mostrati come due
 * informazioni distinte, mai fuse: serve a spiegare all'iscritto perché è
 * finito tra i follower.
 *
 * La riassegnazione di un ruolo flessibile passa dalle **stesse verifiche di un
 * acquisto**: rilascia i consumi del vecchio ruolo, impegna quelli del nuovo, e
 * può fallire con `SOLD_OUT` (definitivo) o `ROLE_ON_HOLD` (temporaneo).
 */
@Component({
  selector: 'app-registrations-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    SearchBarComponent,
    ListItemsWrapperComponent,
    ListItemsSkeletonComponent,
    EntityListItemComponent,
    PaginationComponent,
    ButtonComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    SelectComponent,
    CheckboxComponent,
    AvatarComponent,
    StatusPillComponent,
    DomainErrorComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-domain-error />

      @if (editing()) {
        <keijo-page-section-wrapper
          title="Nuovo iscritto"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          <p class="mirada-hint">
            L’aggiunta manuale serve agli ingressi che non passano dalla vendita online: canale
            esterno, accrediti, iscrizioni raccolte fuori piattaforma.
          </p>
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-select
                [formControl]="form.controls.eventId"
                [data]="eventOptions()"
                label="evento"
                placeholder="Scegli l’evento"
              />
              <keijo-select
                [formControl]="form.controls.channel"
                [data]="channelOptions"
                label="canale"
                placeholder="Provenienza dell’iscrizione"
              />
            </keijo-form-row>
            @if (err('eventId'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="3">
              <keijo-input
                [formControl]="form.controls.holderName"
                label="nome"
                id="holderName"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.holderSurname"
                label="cognome"
                id="holderSurname"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.holderEmail"
                label="email"
                id="holderEmail"
                type="email"
              />
            </keijo-form-row>
            @if (err('holderName'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            @if (err('holderEmail'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="2">
              <keijo-select
                [formControl]="form.controls.declaredRole"
                [data]="declaredRoleOptions"
                label="ruolo dichiarato"
                placeholder="Leader, follower o flessibile"
              />
              <keijo-checkbox [formControl]="form.controls.isMinor" label="Partecipante minorenne" />
            </keijo-form-row>
            <p class="mirada-hint">
              Il ruolo dichiarato è la scelta della persona. Il ruolo assegnato lo calcola il
              motore di capienza: sono due cose diverse e restano distinte.
            </p>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      @if (reassigning(); as target) {
        <keijo-page-section-wrapper
          title="Riassegnazione del ruolo"
          [buttons]="reassignButtons"
          (buttonClick)="onReassignAction($event)"
        >
          <p class="mirada-hint">
            {{ target.holderName }} {{ target.holderSurname }} ha dichiarato
            «{{ declaredLabel(target.declaredRole) }}». La riassegnazione rilascia i consumi del
            ruolo attuale e impegna quelli del nuovo, con le stesse verifiche di un acquisto: se
            il nuovo ruolo non ha capienza, l’operazione viene rifiutata.
          </p>
          <keijo-form-wrapper [formGroup]="reassignForm">
            <keijo-form-row [cols]="1">
              <keijo-select
                [formControl]="reassignForm.controls.role"
                [data]="roleOptions"
                label="nuovo ruolo assegnato"
                placeholder="Leader o follower"
              />
            </keijo-form-row>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        <keijo-search-bar
          [search]="search"
          [filterTabs]="filterTabs()"
          filterTooltip="Filtra gli iscritti"
          (filterChanged)="onFilterChanged($event)"
        />

        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (reg of store.items(); track reg.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="holder">
                    <app-avatar
                      [src]="avatar(reg)"
                      [name]="reg.holderName"
                      [surname]="reg.holderSurname"
                    />
                    <div class="primary">
                      <span class="title">{{ reg.holderName }} {{ reg.holderSurname }}</span>
                      <span class="mirada-muted">{{ reg.holderEmail }}</span>
                    </div>
                  </div>
                </ng-template>

                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="statusUi(reg.status)" />
                    <span class="pair">
                      <span class="mirada-label">dichiarato</span>
                      <app-status-pill [status]="declaredUi(reg.declaredRole)" />
                    </span>
                    <span class="pair">
                      <span class="mirada-label">assegnato</span>
                      @if (reg.assignedRole) {
                        <app-status-pill [status]="assignedUi(reg.assignedRole)" />
                      } @else {
                        <keijo-pill
                          variant="default"
                          [icon]="pendingIcon"
                          tooltip="Il motore di capienza non ha ancora risolto il ruolo"
                        >
                          non ancora assegnato
                        </keijo-pill>
                      }
                    </span>
                    <app-status-pill [status]="channelUi(reg.channel)" />
                    @if (reg.coupleId) {
                      <keijo-pill
                        variant="info"
                        [icon]="coupleIcon"
                        tooltip="Iscrizione legata a una coppia"
                      >
                        coppia #{{ reg.coupleId }}
                      </keijo-pill>
                    }
                    @if (reg.isMinor) {
                      <keijo-pill variant="warning" [icon]="pendingIcon">minorenne</keijo-pill>
                    }
                  </div>
                </ng-template>

                <ng-template #actions>
                  @if (canWrite() && reg.coupleId) {
                    <keijo-button
                      variant="error"
                      [icon]="dissolveIcon"
                      tooltip="Sciogli la coppia"
                      (action)="dissolve(reg)"
                    />
                  }
                  @if (canWrite()) {
                    <keijo-button
                      variant="warning"
                      [icon]="roleIcon"
                      tooltip="Riassegna il ruolo di ballo"
                      (action)="startReassign(reg)"
                    />
                  }
                  <keijo-button
                    variant="accent"
                    [icon]="viewIcon"
                    tooltip="Apri l’iscrizione"
                    (action)="open(reg)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="registrationIcon" title="Nessun iscritto" variant="info">
                <span>
                  Gli iscritti arrivano dalla vendita online sul sito pubblico. Da qui si
                  aggiungono a mano solo gli ingressi che passano da altri canali.
                </span>
              </keijo-info-box>
            }
          </keijo-list-items-wrapper>
        }

        <keijo-pagination
          [paginator]="store.paginator()"
          [paginateResults]="store.paginateResults()"
          (pageChange)="onPage($event)"
          (pageSizeChange)="onPageSize($event)"
        />
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .holder {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        min-width: 0;
      }
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
        gap: 0.5rem;
        align-items: center;
      }
      .pair {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }
    `,
  ],
})
export class RegistrationsListComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly events = inject(EventStore);
  private readonly couples = inject(CoupleStore);

  readonly store = inject(RegistrationStore);

  readonly registrationIcon = howToReg;
  readonly coupleIcon = handshake;
  readonly dissolveIcon = heartBroken;
  readonly roleIcon = swapHoriz;
  readonly viewIcon = visibility;
  readonly pendingIcon = swapHoriz;

  readonly search = new FormControl('', { nonNullable: true });
  readonly editing = signal(false);
  readonly reassigning = signal<Registration | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly eventOptions = signal<SelectOption[]>([]);
  private readonly eventFilterOptions = signal<KeijoFilterOption[]>([]);

  readonly channelOptions: SelectOption[] = REGISTRATION_CHANNEL_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));
  readonly declaredRoleOptions: SelectOption[] = DECLARED_DANCE_ROLE_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));
  readonly roleOptions: SelectOption[] = [
    { label: 'Leader', value: 'LEADER' },
    { label: 'Follower', value: 'FOLLOWER' },
  ];

  /** Il `CHECKIN_OPERATOR` vede `/registrations` **in sola lettura** (§1). */
  readonly canWrite = computed(() => this.auth.can().registrationsWrite);

  readonly filterTabs = computed<KeijoFilterTab[]>(() => [
    {
      field: 'eventId',
      name: 'Evento',
      kind: 'single',
      selectIds: [],
      options: this.eventFilterOptions(),
    },
    {
      field: 'assignedRole',
      name: 'Ruolo assegnato',
      kind: 'single',
      selectIds: [],
      options: [
        { id: 'LEADER', name: 'Leader', checked: false },
        { id: 'FOLLOWER', name: 'Follower', checked: false },
      ],
    },
    {
      field: 'status',
      name: 'Stato',
      kind: 'single',
      selectIds: [],
      options: REGISTRATION_STATUS_OPTIONS.map((o) => ({
        id: o.value,
        name: o.label,
        checked: false,
      })),
    },
    {
      field: 'channel',
      name: 'Canale',
      kind: 'single',
      selectIds: [],
      options: REGISTRATION_CHANNEL_OPTIONS.map((o) => ({
        id: o.value,
        name: o.label,
        checked: false,
      })),
    },
  ]);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];
  readonly reassignButtons: SectionActionButton[] = [
    { id: 'apply', icon: check, label: 'Riassegna', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    eventId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    holderName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    holderSurname: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    holderEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    declaredRole: new FormControl<DeclaredDanceRole>('FLEXIBLE', { nonNullable: true }),
    channel: new FormControl<RegistrationChannel>('EXTERNAL_CHANNEL', { nonNullable: true }),
    isMinor: new FormControl(false, { nonNullable: true }),
  });

  readonly reassignForm = new FormGroup({
    role: new FormControl<DanceRole>('LEADER', { nonNullable: true }),
  });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((value) => void this.store.setQuery({ value: value || undefined }));
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Iscritti');
    this.registerActions();
    await Promise.all([this.store.replaceQuery({}), this.loadEvents()]);
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite()) {
      actions.push({
        id: 'create',
        icon: add,
        label: 'Aggiungi',
        tooltip: 'Aggiungi un iscritto da canale esterno',
        run: () => this.startCreate(),
      });
    }
    actions.push({
      id: 'refresh',
      icon: sync,
      label: 'Aggiorna',
      tooltip: 'Ricarica l’elenco',
      run: () => void this.store.load(),
    });
    this.pageActions.set(actions);
  }

  private async loadEvents(): Promise<void> {
    const lang = this.locale.lang();
    const docs = await this.events.loadAll({}, 100, '');
    this.eventOptions.set(docs.map((e) => ({ label: i18nPlain(e.title, lang), value: e.id })));
    this.eventFilterOptions.set(
      docs.map((e) => ({ id: e.id, name: i18nPlain(e.title, lang), checked: false })),
    );
  }

  onFilterChanged(change: KeijoFilterChange): void {
    const ids = Array.isArray(change.value) ? change.value : [];
    const first = ids.length ? ids[0] : undefined;
    switch (change.field) {
      case 'eventId':
        void this.store.setQuery({ eventId: first ? Number(first) : undefined });
        break;
      case 'assignedRole':
        void this.store.setQuery({ assignedRole: (first as DanceRole) ?? undefined });
        break;
      case 'status':
        void this.store.setQuery({ status: (first as RegistrationStatus) ?? undefined });
        break;
      case 'channel':
        void this.store.setQuery({ channel: (first as RegistrationChannel) ?? undefined });
        break;
    }
  }

  onPage(page: number): void {
    void this.store.setPage(page);
  }
  onPageSize(size: number): void {
    void this.store.setPageSize(size);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  /**
   * Il ritratto dell'iscritto, se ne ha uno **nel proprio profilo**.
   *
   * Non è il dato dell'iscrizione: quello lo digita chi compra, e può comprare
   * per qualcun altro. La fotografia è la persona che la mette nel suo account,
   * quindi si legge di lì e da nessun'altra parte. Chi arriva dalla biglietteria
   * fisica un account non ce l'ha affatto: resta senza, ed è normale.
   */
  avatar(reg: Registration): string | null {
    return reg.personUser?.logoFile?.url ?? reg.personUser?.avatarUrl ?? null;
  }

  statusUi(status: RegistrationStatus) {
    return REGISTRATION_STATUS_UI[status];
  }
  declaredUi(role: DeclaredDanceRole) {
    return DECLARED_DANCE_ROLE_UI[role];
  }
  assignedUi(role: DanceRole) {
    return DANCE_ROLE_UI[role];
  }
  channelUi(channel: RegistrationChannel) {
    return REGISTRATION_CHANNEL_UI[channel];
  }
  declaredLabel(role: DeclaredDanceRole): string {
    return DECLARED_DANCE_ROLE_UI[role].label;
  }

  open(reg: Registration): void {
    void this.router.navigateByUrl(`/registrations/${reg.id}`);
  }

  startCreate(): void {
    this.form.reset({
      declaredRole: 'FLEXIBLE',
      channel: 'EXTERNAL_CHANNEL',
      isMinor: false,
      holderName: '',
      holderSurname: '',
      holderEmail: '',
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
    if (this.form.invalid) {
      this.formErrors.set(['Evento, nome, cognome ed email sono obbligatori.']);
      return;
    }

    const value = this.form.getRawValue();
    try {
      await this.store.create({
        eventId: Number(value.eventId),
        holderName: value.holderName.trim(),
        holderSurname: value.holderSurname.trim(),
        holderEmail: value.holderEmail.trim(),
        declaredRole: value.declaredRole,
        channel: value.channel,
        isMinor: value.isMinor,
      });
      this.toast.show('SUCCESS', 'Iscritto aggiunto.');
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  startReassign(reg: Registration): void {
    this.reassigning.set(reg);
    this.reassignForm.reset({ role: reg.assignedRole ?? 'LEADER' });
  }

  async onReassignAction(button: SectionActionButton): Promise<void> {
    const target = this.reassigning();
    if (button.id === 'cancel' || !target) {
      this.reassigning.set(null);
      return;
    }
    try {
      await this.store.reassignRole(target.id, this.reassignForm.controls.role.value);
      this.reassigning.set(null);
      this.toast.show('SUCCESS', 'Ruolo riassegnato.');
      await this.store.load();
    } catch {
      // `SOLD_OUT` e `ROLE_ON_HOLD` hanno significati opposti e li presenta
      // <app-domain-error>, che dice se la situazione è definitiva o temporanea.
    }
  }

  async dissolve(reg: Registration): Promise<void> {
    if (!reg.coupleId) return;
    const ok = await this.confirm.ask({
      title: 'Sciogliere la coppia?',
      message:
        'Le due iscrizioni restano valide e nessun posto viene rilasciato: cambia solo il legame ' +
        'fra le due persone, che tornano a essere iscritte singolarmente.',
      confirmLabel: 'Sciogli',
      destructive: true,
    });
    if (!ok) return;
    await this.couples.dissolve(reg.coupleId);
    this.toast.show('SUCCESS', 'Coppia sciolta.');
    await this.store.load();
  }
}
