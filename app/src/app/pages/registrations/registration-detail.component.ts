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
  cloudOff,
  contentCopy,
  edit,
  eventSeat,
  handshake,
  heartBroken,
  howToReg,
  payments,
  save,
  schedule,
  swapHoriz,
  warning,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  BALANCE_SETTLEMENT_METHOD_OPTIONS,
  BALANCE_SETTLEMENT_METHOD_UI,
  BalanceSettlementMethod,
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
import { QuotaConsumption, RegistrationBalance } from '../../core/domain/models';
import {
  centsToEuroInput,
  euroInputToCents,
  formatCents,
  formatDateTime,
} from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { ApiClient } from '../../core/api/api.client';
import { ApiError } from '../../core/api/api-error';
import { BalanceSettlementStore } from '../../stores/balance-settlement.store';
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

        @if (balance(); as bal) {
          <keijo-page-section-wrapper
            title="Saldo da versare"
            [buttons]="settling() ? settleButtons : []"
            (buttonClick)="onSettleAction($event)"
          >
            <div class="grid">
              <div>
                <p class="mirada-label">Residuo nato con la vendita</p>
                <p class="mirada-value">{{ euro(bal.dueAmount) }}</p>
                <p class="mirada-hint">
                  È la parte non versata al negozio: l’acconto è stato incassato là, questo si
                  incassa qui. Non è un pagamento della piattaforma e non compare fra gli incassi.
                </p>
              </div>
              <div>
                <p class="mirada-label">Già incassato</p>
                <p class="mirada-value">{{ euro(bal.settledAmount) }}</p>
              </div>
              <div>
                <p class="mirada-label">Ancora aperto</p>
                <p class="mirada-value">{{ euro(bal.openAmount) }}</p>
                @if (bal.openAmount > 0) {
                  <keijo-pill variant="warning" [icon]="balanceIcon">da versare alla cassa</keijo-pill>
                } @else if (bal.openAmount === 0) {
                  <keijo-pill variant="success" [icon]="settledIcon">saldato</keijo-pill>
                } @else {
                  <keijo-pill variant="error" [icon]="conflictIcon">incassato in eccesso</keijo-pill>
                }
              </div>
            </div>

            @if (bal.openAmount < 0) {
              <keijo-info-box [icon]="conflictIcon" title="Incassato più del dovuto" variant="error">
                <span>
                  Due postazioni hanno incassato lo stesso saldo senza vedersi. Le righe restano
                  tutte: quei soldi qualcuno li ha davvero presi in mano, e cancellarne una farebbe
                  quadrare i conti sullo schermo e non nel cassetto. La restituzione avviene fuori
                  piattaforma.
                </span>
              </keijo-info-box>
            }

            @if (settling()) {
              @if (settleErrors().length) {
                <p class="mirada-error">{{ settleErrors().join(' ') }}</p>
              }
              <keijo-form-wrapper [formGroup]="settleForm">
                <keijo-form-row [cols]="3">
                  <keijo-input
                    [formControl]="settleForm.controls.amount"
                    label="importo incassato (€)"
                    id="settleAmount"
                    type="text"
                  />
                  <keijo-select
                    [formControl]="settleForm.controls.method"
                    [data]="methodOptions"
                    label="metodo"
                    placeholder="Contanti, POS, bonifico…"
                  />
                  <keijo-input
                    [formControl]="settleForm.controls.note"
                    label="nota"
                    id="settleNote"
                    type="text"
                    placeholder="Contestava la cifra, pagato in due banconote…"
                  />
                </keijo-form-row>
                <p class="mirada-hint">
                  Il metodo è una spunta, non un incasso: Mirada non prende quei soldi, ne prende
                  nota. Un bonifico arrivato prima dell’evento si registra da qui — è ciò che evita
                  di chiedere alla porta soldi già mandati.
                </p>
              </keijo-form-wrapper>
            }

            <keijo-list-items-wrapper>
              @for (row of bal.settlements; track row.id) {
                <keijo-list-item-wrapper direction="row">
                  <div class="settlement">
                    <span class="mirada-value">{{ euro(row.amount) }}</span>
                    <div class="row">
                      <keijo-pill variant="default" [icon]="methodIcon(row.method)">
                        {{ methodLabel(row.method) }}
                      </keijo-pill>
                      <keijo-pill variant="default" [icon]="clockIcon">
                        {{ when(row.collectedAt) }}
                      </keijo-pill>
                      <keijo-pill variant="default" [icon]="operatorIcon">
                        {{ operatorLabel(row.operatorUserId) }}
                      </keijo-pill>
                      @if (row.deviceId) {
                        <keijo-pill [isID]="true" [icon]="copyIcon">{{ row.deviceId }}</keijo-pill>
                      }
                      @if (row.offline) {
                        <keijo-pill variant="info" [icon]="offlineIcon">dalla coda offline</keijo-pill>
                      }
                      @if (row.conflictWithId) {
                        <keijo-pill variant="error" [icon]="conflictIcon">
                          in conflitto con l’incasso #{{ row.conflictWithId }}
                        </keijo-pill>
                      }
                    </div>
                  </div>
                </keijo-list-item-wrapper>
              } @empty {
                <keijo-info-box [icon]="balanceIcon" title="Nessun incasso registrato" variant="info">
                  <span>
                    Il saldo si versa al check-in, alla cassa. Se è già arrivato per bonifico,
                    registralo da qui: il residuo si chiude e alla porta non verrà chiesto.
                  </span>
                </keijo-info-box>
              }
            </keijo-list-items-wrapper>
          </keijo-page-section-wrapper>
        }

        @if (balanceError(); as guasto) {
          <keijo-page-section-wrapper title="Saldo da versare">
            <keijo-info-box [icon]="conflictIcon" title="Saldo non leggibile" variant="error">
              <span>
                Non è stato possibile leggere il residuo di questa persona: {{ guasto }} Non
                significa che non deve nulla — significa che non lo sappiamo. Prima di lasciar
                passare qualcuno alla porta, ricarica la scheda.
              </span>
            </keijo-info-box>
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
      .settlement {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        width: 100%;
      }
      .settlement .row {
        flex-wrap: wrap;
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
  private readonly api = inject(ApiClient);
  private readonly settlements = inject(BalanceSettlementStore);

  readonly store = inject(RegistrationStore);

  readonly roleIcon = swapHoriz;
  readonly coupleIcon = handshake;
  readonly dissolveIcon = heartBroken;
  readonly seatIcon = eventSeat;
  readonly pendingIcon = celebration;
  readonly balanceIcon = payments;
  readonly settledIcon = checkCircle;
  readonly conflictIcon = warning;
  readonly clockIcon = schedule;
  readonly operatorIcon = howToReg;
  /** La postazione è un codice da **copiare**: è ciò che si cita per contestare un incasso. */
  readonly copyIcon = contentCopy;
  /** L'origine offline è sincronizzazione, non tempo: l'orologio è già del `collectedAt`. */
  readonly offlineIcon = cloudOff;

  private readonly registrationId = signal(0);
  readonly editing = signal(false);
  readonly reassigning = signal(false);
  readonly formErrors = signal<string[]>([]);

  /**
   * Il residuo di questa persona, letto dal server.
   *
   * `null` quando non c'è nulla da mostrare: nessun acconto, oppure chi guarda
   * non tiene la cassa. Non è una sezione nascosta con un `*ngIf` su un dato che
   * è comunque arrivato — la chiamata non si fa proprio, e la cifra non esce dal
   * server (`RB27`).
   */
  readonly balance = signal<RegistrationBalance | null>(null);
  /**
   * Il guasto che ha impedito di leggere il residuo — **mai** il `403` di chi non
   * tiene la cassa, che è già escluso prima della chiamata.
   *
   * Esiste perché `loadBalance()` non può propagare: è atteso in `ngOnInit`, e
   * un'eccezione lì impedirebbe `registerActions()`, lasciando la scheda senza
   * nemmeno i comandi che non c'entrano con il saldo.
   */
  readonly balanceError = signal<string | null>(null);
  readonly settling = signal(false);
  readonly settleErrors = signal<string[]>([]);
  private readonly operatorNames = signal<Map<number, string>>(new Map());

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
  /** Tenere la cassa: vedere l'importo di un saldo e registrarne l'incasso. */
  readonly canSettle = computed(() => this.auth.can().boxOffice);
  readonly consumptions = computed(() => this.store.current()?.quotaConsumptions ?? []);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];
  readonly reassignButtons: SectionActionButton[] = [
    { id: 'apply', icon: check, label: 'Riassegna', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];
  readonly settleButtons: SectionActionButton[] = [
    { id: 'settle', icon: check, label: 'Registra incasso', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly methodOptions: SelectOption[] = BALANCE_SETTLEMENT_METHOD_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));

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

  readonly settleForm = new FormGroup({
    amount: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    method: new FormControl<BalanceSettlementMethod>('CASH', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    // Titolo dell'header = **nome dell'entità**, mai l'id né l'istanza.
    this.headerTitle.set('Iscrizione');
    this.registrationId.set(Number(this.route.snapshot.paramMap.get('id')));
    await this.store.loadOne(this.registrationId());
    await this.loadBalance();
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

    // «Incassa» compare solo a chi tiene la cassa **e** solo se c'è qualcosa da
    // incassare: un comando che apre un modulo per registrare zero euro è un
    // comando che tradisce chi lo preme.
    const bal = this.balance();
    if (this.canSettle() && bal && bal.openAmount > 0) {
      actions.push({
        id: 'settle',
        icon: payments,
        label: 'Incassa',
        tooltip: 'Registra il saldo versato',
        run: () => this.startSettle(),
      });
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

  // ═════════════════════════════════════════════════════════════════════════
  // Il saldo del botteghino — `14` §6, `RF-SAL-14`
  // ═════════════════════════════════════════════════════════════════════════

  euro(cents: number): string {
    return formatCents(cents);
  }

  methodLabel(method: BalanceSettlementMethod): string {
    return BALANCE_SETTLEMENT_METHOD_UI[method].label;
  }

  methodIcon(method: BalanceSettlementMethod) {
    return BALANCE_SETTLEMENT_METHOD_UI[method].icon;
  }

  /** Chi ha incassato. Con il nome, non con un numero: è a lui che si chiede. */
  operatorLabel(operatorUserId: number): string {
    return this.operatorNames().get(operatorUserId) ?? `operatore #${operatorUserId}`;
  }

  /**
   * Legge il residuo — e **solo se ha senso chiederlo**.
   *
   * Chi non tiene la cassa riceverebbe un `403`: non si fa la chiamata per poi
   * nascondere l'errore, non si fa la chiamata. E un `403` inatteso qui non deve
   * far comparire un messaggio d'errore sulla scheda di un'iscrizione che per
   * tutto il resto si legge benissimo: la sezione semplicemente non c'è.
   */
  private async loadBalance(): Promise<void> {
    if (!this.canSettle()) {
      this.balance.set(null);
      return;
    }

    try {
      const bal = await this.settlements.balanceOf(this.registrationId());
      this.balanceError.set(null);
      // Nessun acconto, nessuna sezione: la stragrande maggioranza delle
      // iscrizioni non ha un residuo, e tre cifre a zero non sono un dato.
      //
      // ⚠️ `settlements.length` non è una ridondanza. `sync` accetta un incasso
      // anche su chi non doveva nulla — `NO_BALANCE_DUE` è uno dei conflitti di
      // `BalanceSettlementService`, e la riga **viene creata**, marcata, e
      // lasciata allo staff perché quel contante qualcuno l'ha preso davvero.
      // Questa sezione è il posto dove lo staff la risolve: senza la seconda
      // condizione, l'unico caso in cui il conflitto esiste è l'unico in cui
      // non si vede.
      this.balance.set(bal.dueAmount > 0 || bal.settlements.length > 0 ? bal : null);
      if (bal.settlements.length) {
        await this.loadOperatorNames();
      }
    } catch (err) {
      // Il `403` di chi non tiene la cassa è già escluso sopra: la chiamata non
      // parte nemmeno. Quello che resta qui sono i guasti veri — 5xx, rete
      // caduta, risposta malformata — e su questa pagina un pannello che
      // sparisce si legge «non deve nulla». A un botteghino è la differenza fra
      // chiedere il saldo e lasciar passare, quindi il guasto si dice.
      this.balance.set(null);
      this.balanceError.set(
        err instanceof ApiError && err.kind === 'forbidden'
          ? null
          : (err as Error)?.message || 'Il saldo di questa iscrizione non è leggibile.',
      );
    }
  }

  /** Una lettura sola: gli operatori di cassa di un evento sono una manciata. */
  private async loadOperatorNames(): Promise<void> {
    if (this.operatorNames().size) return;
    try {
      const page = await this.api.list<{ id: number; username: string }>('users', {}, { limit: 200 });
      this.operatorNames.set(new Map((page.docs ?? []).map((u) => [u.id, u.username])));
    } catch {
      // Senza i nomi restano i numeri: è meno leggibile, non è un guasto.
    }
  }

  startSettle(): void {
    const bal = this.balance();
    if (!bal) return;
    this.settleErrors.set([]);
    this.settleForm.reset({
      // Precompilato con ciò che resta aperto: alla porta si versa il saldo
      // intero, e chi incassa non deve ricopiare una cifra che il server sa.
      amount: centsToEuroInput(bal.openAmount),
      method: 'CASH',
      note: '',
    });
    this.settling.set(true);
  }

  async onSettleAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.settling.set(false);
      return;
    }

    const bal = this.balance();
    if (!bal) return;

    this.settleErrors.set([]);
    const amount = euroInputToCents(this.settleForm.controls.amount.value);
    if (amount <= 0) {
      this.settleErrors.set(['Scrivi l’importo che hai incassato.']);
      return;
    }

    try {
      const note = this.settleForm.controls.note.value.trim();
      await this.settlements.create({
        registrationId: this.registrationId(),
        amount,
        method: this.settleForm.controls.method.value,
        ...(note ? { note } : {}),
      });
      this.toast.show('SUCCESS', 'Incasso registrato.');
      this.settling.set(false);
      await this.loadBalance();
      this.registerActions();
    } catch (err) {
      // Il server rifiuta con un messaggio in italiano già pronto — «il saldo è
      // già stato versato», «l'importo supera il residuo ancora aperto» — e
      // sostituirlo con un «controlla i campi» generico toglierebbe a chi ha i
      // soldi in mano l'unica informazione che gli serve.
      const unmatched = applyZodIssues(this.settleForm, err);
      this.settleErrors.set(
        unmatched.length ? unmatched : [(err as Error).message || 'Incasso non registrato.'],
      );
    }
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
