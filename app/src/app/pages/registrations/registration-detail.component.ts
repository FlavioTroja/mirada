import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonComponent,
  CheckboxComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  ListItemsWrapperComponent,
  ListItemWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import {
  cancel as cancelIcon,
  celebration,
  check,
  checkCircle,
  close,
  edit,
  eventSeat,
  handshake,
  heartBroken,
  howToReg,
  save,
  swapHoriz,
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
  QUOTA_SCOPE_UI,
  REGISTRATION_CHANNEL_OPTIONS,
  REGISTRATION_CHANNEL_UI,
  REGISTRATION_STATUS_UI,
  RegistrationChannel,
} from '../../core/domain/enums';
import { QuotaConsumption } from '../../core/domain/models';
import { formatDateTime } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { CoupleStore } from '../../stores/couple.store';
import { RegistrationStore } from '../../stores/registration.store';
import { ConfirmService } from '../../shared/confirm.service';
import { DomainErrorComponent } from '../../shared/domain-error.component';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';

/**
 * `/registrations/:id` — la scheda dell'iscrizione (§4.3).
 *
 * Mostra ciò che il contratto API espone oggi: anagrafica, ruolo dichiarato e
 * ruolo assegnato **distinti**, canale, stato, coppia e i **consumi di quota**,
 * cioè cosa questa iscrizione occupa davvero.
 *
 * Ordine di provenienza, biglietti, servizi acquistati, esiti dei requisiti e
 * check-in per sessione fanno parte del §4.3 ma richiedono `Order`, `Ticket`,
 * `RequirementOutcome` e `CheckIn`: nessuna di queste basi REST è attiva, e la
 * scheda lo dichiara invece di mostrare sezioni vuote.
 */
@Component({
  selector: 'app-registration-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ListItemsWrapperComponent,
    ListItemWrapperComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    SelectComponent,
    CheckboxComponent,
    ButtonComponent,
    I18nTextComponent,
    StatusPillComponent,
    DomainErrorComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-domain-error />

      @if (store.current(); as reg) {
        <keijo-page-section-wrapper title="Identità e ruolo">
          <div class="grid">
            <div>
              <p class="mirada-label">Iscritto</p>
              <p class="mirada-value">{{ reg.holderName }} {{ reg.holderSurname }}</p>
              <p class="mirada-muted">{{ reg.holderEmail }}</p>
            </div>
            <div>
              <p class="mirada-label">Evento</p>
              <p class="mirada-value">
                @if (reg.event) {
                  <app-i18n-text [value]="reg.event.title" />
                } @else {
                  Evento #{{ reg.eventId }}
                }
              </p>
            </div>
            <div>
              <p class="mirada-label">Ruolo dichiarato</p>
              <app-status-pill [status]="declaredUi(reg.declaredRole)" />
              <p class="mirada-hint">La scelta della persona al momento dell’iscrizione.</p>
            </div>
            <div>
              <p class="mirada-label">Ruolo assegnato</p>
              @if (reg.assignedRole) {
                <app-status-pill [status]="assignedUi(reg.assignedRole)" />
              } @else {
                <keijo-pill variant="default" [icon]="roleIcon">non ancora assegnato</keijo-pill>
              }
              <p class="mirada-hint">
                Il ruolo effettivo, risolto dal motore di capienza. È distinto da quello
                dichiarato: è così che si spiega all’iscritto perché è stato messo tra i follower.
              </p>
            </div>
            <div>
              <p class="mirada-label">Stato</p>
              <app-status-pill [status]="statusUi(reg.status)" />
              @if (reg.confirmedAt) {
                <p class="mirada-hint">Confermata il {{ when(reg.confirmedAt) }}</p>
              }
              @if (reg.declinedAt) {
                <p class="mirada-hint">Rifiutata il {{ when(reg.declinedAt) }}</p>
              }
            </div>
            <div>
              <p class="mirada-label">Canale</p>
              <app-status-pill [status]="channelUi(reg.channel)" />
            </div>
            <div>
              <p class="mirada-label">Coppia</p>
              @if (reg.coupleId) {
                <div class="row">
                  <keijo-pill variant="info" [icon]="coupleIcon">coppia #{{ reg.coupleId }}</keijo-pill>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="dissolveIcon"
                      tooltip="Sciogli la coppia"
                      (action)="dissolve()"
                    />
                  }
                </div>
              } @else {
                <p class="mirada-muted">Iscrizione singola</p>
              }
            </div>
          </div>
        </keijo-page-section-wrapper>

        @if (editing()) {
          <keijo-page-section-wrapper
            title="Modifica dati dell’iscrizione"
            [buttons]="editButtons"
            (buttonClick)="onEditAction($event)"
          >
            @if (formErrors().length) {
              <p class="mirada-error">{{ formErrors().join(' ') }}</p>
            }
            <keijo-form-wrapper [formGroup]="form">
              <keijo-form-row [cols]="3">
                <keijo-input
                  [formControl]="form.controls.holderName"
                  label="nome"
                  id="detailName"
                  type="text"
                />
                <keijo-input
                  [formControl]="form.controls.holderSurname"
                  label="cognome"
                  id="detailSurname"
                  type="text"
                />
                <keijo-input
                  [formControl]="form.controls.holderEmail"
                  label="email"
                  id="detailEmail"
                  type="email"
                />
              </keijo-form-row>
              @if (err('holderEmail'); as msg) {
                <p class="mirada-error">{{ msg }}</p>
              }

              <keijo-form-row [cols]="3">
                <keijo-select
                  [formControl]="form.controls.declaredRole"
                  [data]="declaredRoleOptions"
                  label="ruolo dichiarato"
                  placeholder="Leader, follower o flessibile"
                />
                <keijo-select
                  [formControl]="form.controls.channel"
                  [data]="channelOptions"
                  label="canale"
                  placeholder="Provenienza dell’iscrizione"
                />
                <keijo-checkbox
                  [formControl]="form.controls.isMinor"
                  label="Partecipante minorenne"
                />
              </keijo-form-row>
              <p class="mirada-hint">
                Il ruolo assegnato non si modifica da qui: passa dalla riassegnazione, che rifà
                le stesse verifiche di capienza di un acquisto.
              </p>
            </keijo-form-wrapper>
          </keijo-page-section-wrapper>
        }

        @if (reassigning()) {
          <keijo-page-section-wrapper
            title="Riassegnazione del ruolo"
            [buttons]="reassignButtons"
            (buttonClick)="onReassignAction($event)"
          >
            <p class="mirada-hint">
              La riassegnazione rilascia i consumi del ruolo attuale e impegna quelli del nuovo.
              Se il nuovo ruolo è esaurito l’operazione viene rifiutata; se è solo sospeso per
              sbilancio, il rifiuto è temporaneo e si risolve da sé.
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

        <keijo-page-section-wrapper title="Capienza impegnata">
          <p class="mirada-hint">
            Ogni riga è un posto occupato da questa iscrizione su una quota di capienza. È il
            registro che rende il rilascio esatto anziché ricostruito.
          </p>
          <keijo-list-items-wrapper>
            @for (row of consumptions(); track row.id) {
              <keijo-list-item-wrapper direction="row">
                <div class="consumption">
                  <span class="mirada-value">{{ describeQuota(row) }}</span>
                  <keijo-pill variant="default" [icon]="seatIcon">
                    {{ row.quantity }} {{ row.quantity === 1 ? 'posto' : 'posti' }}
                  </keijo-pill>
                </div>
              </keijo-list-item-wrapper>
            } @empty {
              <keijo-info-box [icon]="seatIcon" title="Nessun posto impegnato" variant="info">
                <span>
                  L’iscrizione non impegna ancora alcuna quota: succede quando la conferma del
                  pagamento non è arrivata, o quando l’evento non ha vincoli di capienza.
                </span>
              </keijo-info-box>
            }
          </keijo-list-items-wrapper>
        </keijo-page-section-wrapper>

        <keijo-page-section-wrapper title="Non ancora disponibile">
          <keijo-info-box
            [icon]="pendingIcon"
            title="Ordine, biglietti, requisiti e check-in"
            variant="info"
          >
            <span>
              Il §4.3 prevede in questa scheda anche l’ordine di provenienza, i biglietti emessi,
              i servizi acquistati, gli esiti dei requisiti e i check-in per sessione. Le basi
              REST di <strong>Order</strong>, <strong>Ticket</strong>,
              <strong>RequirementOutcome</strong> e <strong>CheckIn</strong> non sono ancora
              esposte dal contratto condiviso: queste sezioni compariranno quando lo saranno.
            </span>
          </keijo-info-box>
        </keijo-page-section-wrapper>
      }
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .consumption {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        width: 100%;
      }
    `,
  ],
})
export class RegistrationDetailComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly couples = inject(CoupleStore);

  readonly store = inject(RegistrationStore);

  readonly roleIcon = swapHoriz;
  readonly coupleIcon = handshake;
  readonly dissolveIcon = heartBroken;
  readonly seatIcon = eventSeat;
  readonly pendingIcon = celebration;

  private readonly registrationId = signal(0);
  readonly editing = signal(false);
  readonly reassigning = signal(false);
  readonly formErrors = signal<string[]>([]);

  readonly declaredRoleOptions: SelectOption[] = DECLARED_DANCE_ROLE_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));
  readonly channelOptions: SelectOption[] = REGISTRATION_CHANNEL_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));
  readonly roleOptions: SelectOption[] = [
    { label: 'Leader', value: 'LEADER' },
    { label: 'Follower', value: 'FOLLOWER' },
  ];

  readonly canWrite = computed(() => this.auth.can().registrationsWrite);
  readonly consumptions = computed(() => this.store.current()?.quotaConsumptions ?? []);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];
  readonly reassignButtons: SectionActionButton[] = [
    { id: 'apply', icon: check, label: 'Riassegna', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    holderName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    holderSurname: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    holderEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    declaredRole: new FormControl<DeclaredDanceRole>('FLEXIBLE', { nonNullable: true }),
    channel: new FormControl<RegistrationChannel>('ONLINE_SALE', { nonNullable: true }),
    isMinor: new FormControl(false, { nonNullable: true }),
  });

  readonly reassignForm = new FormGroup({
    role: new FormControl<DanceRole>('LEADER', { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    // Titolo dell'header = **nome dell'entità**, mai l'id né l'istanza.
    this.headerTitle.set('Iscrizione');
    this.registrationId.set(Number(this.route.snapshot.paramMap.get('id')));
    await this.store.loadOne(this.registrationId());
    this.registerActions();
  }

  private registerActions(): void {
    const reg = this.store.current();
    const actions: PageAction[] = [];
    if (!reg) {
      this.pageActions.set(actions);
      return;
    }

    if (this.canWrite()) {
      // «Modifica», non «Salva»: `startEdit()` apre la modalità di modifica e non
      // scrive nulla — il salvataggio vero è il pulsante nel footer della sezione.
      // Un'azione etichettata «Salva» che non salva tradisce chi la preme.
      // (keijo-fe-check, 4 agosto 2026, rilievo A3.)
      actions.push({
        id: 'edit',
        icon: edit,
        label: 'Modifica',
        tooltip: 'Modifica i dati dell’iscrizione',
        run: () => this.startEdit(),
      });
      actions.push({
        id: 'reassign',
        icon: swapHoriz,
        label: 'Riassegna',
        tooltip: 'Riassegna il ruolo di ballo',
        run: () => this.startReassign(),
      });
      if (reg.status !== 'CONFIRMED') {
        actions.push({
          id: 'confirm',
          icon: checkCircle,
          label: 'Conferma',
          tooltip: 'Conferma l’iscrizione',
          run: () => void this.confirmRegistration(),
        });
      }
      if (reg.status !== 'DECLINED') {
        actions.push({
          id: 'decline',
          icon: cancelIcon,
          label: 'Rifiuta',
          tooltip: 'Rifiuta l’iscrizione',
          run: () => void this.declineRegistration(),
        });
      }
    }
    this.pageActions.set(actions);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  when(value: string | null | undefined): string {
    return formatDateTime(value);
  }

  declaredUi(role: DeclaredDanceRole) {
    return DECLARED_DANCE_ROLE_UI[role];
  }
  assignedUi(role: DanceRole) {
    return DANCE_ROLE_UI[role];
  }
  statusUi(status: keyof typeof REGISTRATION_STATUS_UI) {
    return REGISTRATION_STATUS_UI[status];
  }
  channelUi(channel: RegistrationChannel) {
    return REGISTRATION_CHANNEL_UI[channel];
  }

  describeQuota(row: QuotaConsumption): string {
    const quota = row.capacityQuota;
    if (!quota) return `Quota #${row.capacityQuotaId}`;
    const scope = QUOTA_SCOPE_UI[quota.scope].label;
    const role = quota.role ? ` — ${DANCE_ROLE_UI[quota.role].label}` : '';
    return `${scope}${role}`;
  }

  startEdit(): void {
    const reg = this.store.current();
    if (!reg) return;
    this.form.reset({
      holderName: reg.holderName,
      holderSurname: reg.holderSurname,
      holderEmail: reg.holderEmail,
      declaredRole: reg.declaredRole,
      channel: reg.channel,
      isMinor: reg.isMinor,
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
      this.formErrors.set(['Nome, cognome ed email sono obbligatori.']);
      return;
    }

    const value = this.form.getRawValue();
    try {
      await this.store.update(this.registrationId(), {
        holderName: value.holderName.trim(),
        holderSurname: value.holderSurname.trim(),
        holderEmail: value.holderEmail.trim(),
        declaredRole: value.declaredRole,
        channel: value.channel,
        isMinor: value.isMinor,
      });
      this.editing.set(false);
      this.toast.show('SUCCESS', 'Iscrizione aggiornata.');
      await this.store.loadOne(this.registrationId());
      this.registerActions();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  startReassign(): void {
    const reg = this.store.current();
    this.reassignForm.reset({ role: reg?.assignedRole ?? 'LEADER' });
    this.reassigning.set(true);
  }

  async onReassignAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.reassigning.set(false);
      return;
    }
    try {
      await this.store.reassignRole(this.registrationId(), this.reassignForm.controls.role.value);
      this.reassigning.set(false);
      this.toast.show('SUCCESS', 'Ruolo riassegnato.');
      await this.store.loadOne(this.registrationId());
      this.registerActions();
    } catch {
      // `SOLD_OUT` (definitivo) e `ROLE_ON_HOLD` (temporaneo) sono presentati da
      // <app-domain-error> con formulazioni diverse: non vanno mai confusi.
    }
  }

  private async confirmRegistration(): Promise<void> {
    await this.store.confirm(this.registrationId());
    this.toast.show('SUCCESS', 'Iscrizione confermata.');
    await this.store.loadOne(this.registrationId());
    this.registerActions();
  }

  private async declineRegistration(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Rifiutare l’iscrizione?',
      message:
        'L’iscrizione risulterà rifiutata e i posti che aveva impegnato tornano disponibili ' +
        'per gli altri. L’operazione è registrata.',
      confirmLabel: 'Rifiuta',
      destructive: true,
    });
    if (!ok) return;
    await this.store.decline(this.registrationId());
    this.toast.show('SUCCESS', 'Iscrizione rifiutata.');
    await this.store.loadOne(this.registrationId());
    this.registerActions();
  }

  async dissolve(): Promise<void> {
    const reg = this.store.current();
    if (!reg?.coupleId) return;
    const ok = await this.confirm.ask({
      title: 'Sciogliere la coppia?',
      message:
        'Le due iscrizioni restano valide e nessun posto viene rilasciato: cambia solo il legame ' +
        'fra le due persone.',
      confirmLabel: 'Sciogli',
      destructive: true,
    });
    if (!ok) return;
    await this.couples.dissolve(reg.coupleId);
    this.toast.show('SUCCESS', 'Coppia sciolta.');
    await this.store.loadOne(this.registrationId());
  }
}
