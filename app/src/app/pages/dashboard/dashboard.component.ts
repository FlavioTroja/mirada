import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  InfoBoxComponent,
  LabeledProgressComponent,
  ListItemsWrapperComponent,
  ListItemWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import {
  add,
  celebration,
  checklist,
  eventSeat,
  favorite,
  howToReg,
  payments,
  scale,
  sell,
  sync,
  trendingUp,
  warning,
  wifi,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  AttendanceSection,
  CapacityQuotaLine,
  CapacitySection,
  CommittedSection,
  CouplesSection,
  MissingRequirementsSection,
  RegistrationsByRole,
  RequirementsSection,
  RevenueSection,
  SoldSection,
  TrendSection,
  isAvailable,
  unavailableOf,
} from '../../core/domain/dashboard';
import { EVENT_STATUS_UI, PAYOUT_STATUS_UI } from '../../core/domain/enums';
import { MiradaEvent } from '../../core/domain/models';
import { formatCents, formatDate, formatDateTime, formatImbalance } from '../../core/i18n/format';
import { I18nText, LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { REALTIME_EVENTS, RealtimeService } from '../../core/realtime/realtime.service';
import { DashboardStore } from '../../stores/dashboard.store';
import { EventStore } from '../../stores/event.store';
import { OrganizationStore } from '../../stores/organization.store';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { LiveRegistrationsComponent } from '../../shared/live-registrations.component';
import { UnavailableSectionComponent } from '../../shared/unavailable-section.component';

/**
 * `/dashboard` — il **Cruscotto** dell'evento (§4.1), su
 * `GET /events/:id/dashboard` (§3.7).
 *
 * **`RB21` è il punto della pagina.** La risposta porta per ogni sezione
 * `available` e `basedOn`, e se non calcolabile `requires` e `reason`. Le
 * sezioni `available: false` **non vengono nascoste né mostrate come zero**:
 * compaiono dichiarate *non ancora calcolabili*, con il motivo del backend.
 *
 * Due nomi che non vanno confusi:
 *  - `committedByTicketType` è ciò che il motore di capienza ha **impegnato**,
 *    non venduto e non incassato;
 *  - `soldByTicketType` è ciò che è stato **saldato**. Le due divergono per
 *    tutta la durata di una prenotazione e non vanno mai sommate.
 *
 * È anche l'unico posto dove si vede il **realtime**: alla ricezione di un
 * frame WebSocket (§3.9) **si rifà la GET**, il payload non entra mai nello
 * store.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    SelectComponent,
    PillComponent,
    InfoBoxComponent,
    ListItemsWrapperComponent,
    ListItemWrapperComponent,
    LabeledProgressComponent,
    StatusPillComponent,
    LiveRegistrationsComponent,
    UnavailableSectionComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <!-- ---------------------------------------------------- selettore -->
      <keijo-page-section-wrapper title="Evento">
        <keijo-select
          [formControl]="eventControl"
          [data]="eventOptions()"
          label="evento"
          placeholder="Scegli l’evento da guardare"
        />

        @if (selectedEvent(); as ev) {
          <div class="head">
            <app-status-pill [status]="statusUi(ev)" />
            <keijo-pill variant="default" [icon]="eventIcon" tooltip="Periodo dell’evento">
              {{ range(ev) }}
            </keijo-pill>
            @if (payoutUi(); as payout) {
              <app-status-pill [status]="payout" />
            }
            <keijo-pill
              [variant]="realtime.connected() ? 'success' : 'default'"
              [icon]="liveIcon"
              [tooltip]="
                realtime.connected()
                  ? 'Canale in tempo reale attivo: alla ricezione di un segnale il cruscotto rilegge i dati'
                  : 'Canale in tempo reale non connesso: i dati si aggiornano solo su richiesta'
              "
            >
              {{ realtime.connected() ? 'in tempo reale' : 'non in tempo reale' }}
            </keijo-pill>
            @if (store.lastRefreshAt(); as at) {
              <span class="mirada-hint">letto alle {{ time(at) }}</span>
            }
          </div>

          @if (!ev.manageExternalChannels) {
            <p class="mirada-hint">
              Questo evento non gestisce canali di vendita esterni: <strong>i conteggi qui sotto
              riguardano le sole vendite online</strong>. Un conteggio parziale presentato come
              completo è peggio di nessun conteggio.
            </p>
          }
        } @else if (!eventOptions().length) {
          <keijo-info-box [icon]="eventIcon" title="Nessun evento da guardare" variant="info">
            <span>
              Il cruscotto legge un evento alla volta. Crea il primo evento dal workspace: finché
              non esiste, non c’è nulla da contare.
            </span>
          </keijo-info-box>
        }

        @if (onlyDrafts()) {
          <p class="mirada-hint">
            Nessun evento è in vendita: l’elenco mostra anche le bozze. Il cruscotto di una bozza è
            a zero per costruzione, non perché nessuno si sia iscritto.
          </p>
        }
      </keijo-page-section-wrapper>

      @if (store.data(); as data) {
        <!-- --------------------------------------------------- perimetro -->
        <keijo-page-section-wrapper title="Su cosa è calcolato">
          <p class="mirada-hint">{{ data.perimeter.note }}</p>
          @if (data.perimeter.missingEntities.length) {
            <div class="pills">
              <p class="mirada-label">Non ancora costruite</p>
              @for (entity of data.perimeter.missingEntities; track entity) {
                <keijo-pill
                  variant="default"
                  [icon]="pendingIcon"
                  tooltip="Entità del contratto non ancora costruita: ciò che dipende da essa non è calcolabile"
                >
                  {{ entity }}
                </keijo-pill>
              }
            </div>
          }
        </keijo-page-section-wrapper>

        <!-- ------------------------------------------ iscritti per ruolo -->
        <keijo-page-section-wrapper title="Iscritti per ruolo">
          @if (roles(); as section) {
            <div class="tiles">
              <div class="tile">
                <p class="mirada-label">Leader</p>
                <p class="mirada-value big">{{ section.leader }}</p>
              </div>
              <div class="tile">
                <p class="mirada-label">Follower</p>
                <p class="mirada-value big">{{ section.follower }}</p>
              </div>
              <div class="tile">
                <p class="mirada-label">Ruolo non ancora assegnato</p>
                <p class="mirada-value big">{{ section.unassigned }}</p>
              </div>
              <div class="tile">
                <p class="mirada-label">Totale iscritti</p>
                <p class="mirada-value big">{{ section.total }}</p>
              </div>
            </div>

            <div class="pills">
              <keijo-pill
                [variant]="imbalanceAtLimit() ? 'warning' : 'default'"
                [icon]="balanceIcon"
                tooltip="Sbilancio corrente fra i ruoli, con la tolleranza configurata"
              >
                {{ imbalanceLabel() }}
              </keijo-pill>
              @if (imbalanceAtLimit()) {
                <keijo-pill
                  variant="warning"
                  [icon]="warningIcon"
                  tooltip="Blocco temporaneo per sbilancio: può sbloccarsi appena arriva il ruolo mancante"
                >
                  {{ heldRoleLabel() }} in attesa
                </keijo-pill>
              }
            </div>
            @if (imbalanceAtLimit()) {
              <p class="mirada-hint">
                «In attesa» non è «esaurito»: sono due stati opposti. Le iscrizioni del ruolo in
                eccesso si sbloccano appena arriva il ruolo mancante.
              </p>
            }

            <p class="mirada-hint">Calcolato su: {{ section.basedOn.join(', ') }}.</p>
            @if (section.note) {
              <p class="mirada-hint">{{ section.note }}</p>
            }
          } @else {
            <app-unavailable-section
              label="Iscritti per ruolo"
              [section]="unavailable('registrationsByRole')"
            />
          }
        </keijo-page-section-wrapper>

        <!-- ------------------------------------------------- capienza ----->
        <app-live-registrations [eventId]="selectedEvent()?.id ?? null" />

        <keijo-page-section-wrapper title="Capienza">
          @if (capacity(); as section) {
            @if (section.room; as room) {
              <keijo-labeled-progress
                [icon]="seatIcon"
                label="Capienza della sala"
                [current]="room.consumed"
                [total]="room.limit"
                [color]="room.remaining > 0 ? 'accent' : 'warning'"
              />
              <p class="mirada-hint">
                {{ room.consumed }} posti impegnati su {{ room.limit }}, {{ room.remaining }}
                residui.
              </p>
            } @else {
              <keijo-info-box [icon]="seatIcon" title="Nessuna quota di sala" variant="info">
                <span>
                  L’evento non ha una quota di capienza della sala. <strong>Assenza di quota
                  significa assenza di vincolo</strong>, non zero posti: il motore non tiene alcun
                  contatore per la sala.
                </span>
              </keijo-info-box>
            }

            @if (section.quotas.length) {
              <p class="mirada-hint">
                Le quote sono raggruppate per ambito. Quelle a zero non sono un errore: una
                quota configurata e mai toccata dice che quel posto è ancora tutto disponibile.
              </p>
              @for (gruppo of quotaGroups(); track gruppo.scope) {
                <p class="mirada-label">{{ gruppo.title }} — {{ gruppo.quotas.length }}</p>
                <keijo-list-items-wrapper>
                  @for (quota of gruppo.quotas; track quota.id) {
                  <keijo-list-item-wrapper direction="row">
                    <div class="row">
                      <span class="mirada-value quota-name">{{ quotaName(quota) }}</span>
                      @if (quotaQualifier(quota); as qual) {
                        <keijo-pill variant="default" [icon]="seatIcon">{{ qual }}</keijo-pill>
                      }
                      <span class="mirada-hint">
                        {{ quota.consumed }} / {{ quota.limit }} — {{ quota.remaining }} residui
                      </span>
                      @if (quota.limiting) {
                        <keijo-pill
                          variant="info"
                          [icon]="checklistIcon"
                          tooltip="Quota limitante: concorre a decidere se la vendita è possibile"
                        >
                          limitante
                        </keijo-pill>
                      }
                    </div>
                  </keijo-list-item-wrapper>
                  }
                </keijo-list-items-wrapper>
              }
            }
            <p class="mirada-hint">Calcolato su: {{ section.basedOn.join(', ') }}.</p>
          } @else {
            <app-unavailable-section label="Capienza" [section]="unavailable('capacity')" />
          }
        </keijo-page-section-wrapper>

        <!-- --------------------------------- impegnato per titolo -------->
        <keijo-page-section-wrapper title="Impegnato per titolo d’ingresso">
          @if (committed(); as section) {
            <p class="mirada-hint">
              Sono <strong>unità impegnate</strong> dal motore di capienza, non biglietti venduti
              né incassati: finché ordini e pagamenti non esistono, le due grandezze non
              coincidono.
            </p>
            @if (section.items.length) {
              <keijo-list-items-wrapper>
                @for (item of section.items; track item.ticketTypeId) {
                  <keijo-list-item-wrapper direction="row">
                    <div class="row">
                      <span class="mirada-value">{{ name(item.name) }}</span>
                      @if (item.limit === null) {
                        <keijo-pill
                          variant="default"
                          [icon]="pendingIcon"
                          tooltip="Nessuna quota configurata: il motore non tiene alcun contatore per questo titolo"
                        >
                          nessuna quota
                        </keijo-pill>
                      } @else {
                        <keijo-pill variant="info" [icon]="sellIcon">
                          {{ item.committed }} / {{ item.limit }} impegnati
                        </keijo-pill>
                        <span class="mirada-hint">{{ item.remaining }} residui</span>
                      }
                    </div>
                  </keijo-list-item-wrapper>
                }
              </keijo-list-items-wrapper>
            } @else {
              <p class="mirada-hint">Nessun titolo d’ingresso ha ancora unità impegnate.</p>
            }
            <p class="mirada-hint">Calcolato su: {{ section.basedOn.join(', ') }}.</p>
          } @else {
            <app-unavailable-section
              label="Impegnato per titolo"
              [section]="unavailable('committedByTicketType')"
            />
          }
        </keijo-page-section-wrapper>

        <!-- ------------------------------------------- venduto per titolo -->
        <keijo-page-section-wrapper title="Venduto per titolo d’ingresso">
          @if (sold(); as section) {
            <p class="mirada-hint">
              È il <strong>saldato</strong>, non l’impegnato: finché una prenotazione è in
              corso i posti sono già sottratti agli altri, ma nessuno li ha ancora comprati.
              I due contatori divergono per quindici minuti e non vanno sommati.
            </p>
            @if (soldTotal() > 0) {
              <keijo-list-items-wrapper>
                @for (item of section.items; track item.ticketTypeId) {
                  @if (item.sold > 0) {
                    <keijo-list-item-wrapper direction="row">
                      <div class="row">
                        <span class="mirada-value">{{ name(item.name) }}</span>
                        <keijo-pill variant="success" [icon]="sellIcon">
                          {{ item.sold }} venduti
                        </keijo-pill>
                        <span class="mirada-hint">{{ cents(item.gross) }}</span>
                      </div>
                    </keijo-list-item-wrapper>
                  }
                }
              </keijo-list-items-wrapper>
              @if (section.servicesGross) {
                <p class="mirada-hint">
                  Più {{ cents(section.servicesGross) }} di servizi accessori, che biglietti
                  non sono e restano fuori dai conteggi per titolo.
                </p>
              }
            } @else {
              <p class="mirada-muted">Nessun titolo d’ingresso è ancora stato saldato.</p>
            }
            <p class="mirada-hint">Calcolato su: {{ section.basedOn.join(', ') }}.</p>
          } @else {
            <app-unavailable-section
              label="Venduto per titolo"
              [section]="unavailable('soldByTicketType')"
            />
          }
        </keijo-page-section-wrapper>

        <!-- ------------------------------------------------ incasso netto -->
        <keijo-page-section-wrapper title="Incasso">
          @if (revenue(); as section) {
            <div class="tiles">
              <div class="tile">
                <p class="mirada-label">All’organizzatore</p>
                <p class="mirada-value big">{{ cents(section.subtotal) }}</p>
              </div>
              <div class="tile">
                <p class="mirada-label">Diritti di prevendita</p>
                <p class="mirada-value big">{{ cents(section.presaleRights) }}</p>
              </div>
              <div class="tile">
                <p class="mirada-label">Pagato dai compratori</p>
                <p class="mirada-value big">{{ cents(section.total) }}</p>
              </div>
              <div class="tile">
                <p class="mirada-label">Realmente incassato</p>
                <p class="mirada-value big">{{ cents(section.cashed) }}</p>
              </div>
            </div>

            <p class="mirada-hint">{{ revenueLabel() }}</p>
            @if (!section.presaleRights && section.total) {
              <p class="mirada-hint">
                I diritti di prevendita sono a zero perché la tariffa non è ancora stata
                decisa: su questo evento la piattaforma non trattiene nulla.
              </p>
            }
            <p class="mirada-hint">{{ section.note }}</p>
          } @else {
            <app-unavailable-section label="Incasso" [section]="unavailable('netRevenue')" />
          }
        </keijo-page-section-wrapper>

        <!-- ------------------------------------------------------ coppie -->
        <keijo-page-section-wrapper title="Coppie">
          @if (couples(); as section) {
            <div class="tiles">
              <div class="tile">
                <p class="mirada-label">Complete</p>
                <p class="mirada-value big">{{ section.complete }}</p>
              </div>
              <div class="tile">
                <p class="mirada-label">Incomplete</p>
                <p class="mirada-value big">{{ section.incomplete }}</p>
              </div>
              <div class="tile">
                <p class="mirada-label">Sciolte</p>
                <p class="mirada-value big">{{ section.dissolved }}</p>
              </div>
            </div>
            @if (section.note) {
              <p class="mirada-hint">{{ section.note }}</p>
            }
            <p class="mirada-hint">Calcolato su: {{ section.basedOn.join(', ') }}.</p>
          } @else {
            <app-unavailable-section label="Coppie" [section]="unavailable('couples')" />
          }
        </keijo-page-section-wrapper>

        <!-- -------------------------------------------------- requisiti --->
        <keijo-page-section-wrapper title="Requisiti">
          @if (requirements(); as section) {
            @if (section.configured.length) {
              <keijo-list-items-wrapper>
                @for (req of section.configured; track req.eventRequirementId) {
                  <keijo-list-item-wrapper direction="row">
                    <div class="row">
                      <span class="mirada-value">{{ name(req.label) }}</span>
                      @if (req.mandatory) {
                        <keijo-pill variant="warning" [icon]="checklistIcon">obbligatorio</keijo-pill>
                      }
                    </div>
                  </keijo-list-item-wrapper>
                }
              </keijo-list-items-wrapper>
            } @else {
              <p class="mirada-hint">Nessun requisito configurato su questo evento.</p>
            }
            @if (section.note) {
              <p class="mirada-hint">{{ section.note }}</p>
            }
          } @else {
            <app-unavailable-section label="Requisiti" [section]="unavailable('requirements')" />
          }

          @if (missingRequirements(); as section) {
            <h3 class="mirada-value">Requisiti mancanti</h3>
            @if (section.registrationsWithMissing) {
              <p class="mirada-hint">
                {{ section.registrationsWithMissing }} iscrizioni hanno almeno un requisito da
                sistemare. Di ciascun requisito si riporta il nome e il conteggio, mai il
                contenuto dichiarato.
              </p>
              <keijo-list-items-wrapper>
                @for (req of section.byRequirement; track req.eventRequirementId) {
                  <keijo-list-item-wrapper direction="row">
                    <div class="row">
                      <span class="mirada-value">{{ name(req.label) }}</span>
                      <keijo-pill variant="warning" [icon]="checklistIcon">
                        {{ req.missing }} mancanti
                      </keijo-pill>
                      @if (req.mandatory) {
                        <keijo-pill variant="error" [icon]="checklistIcon">obbligatorio</keijo-pill>
                      }
                    </div>
                  </keijo-list-item-wrapper>
                }
              </keijo-list-items-wrapper>
            } @else {
              <p class="mirada-muted">Nessuna iscrizione ha requisiti in sospeso.</p>
            }
          } @else {
            <app-unavailable-section
              label="Requisiti mancanti"
              [section]="unavailable('missingRequirements')"
            />
          }
        </keijo-page-section-wrapper>

        <!-- ------------------------------------------------- presenze ---->
        <keijo-page-section-wrapper title="Presenze">
          @if (attendance(); as section) {
            <p class="mirada-hint">
              Le presenze sono un <strong>asse a sé</strong>: il check-in non consuma capienza,
              e questo contatore non va sommato a quelli di quota. Uno misura l’ammissione,
              l’altro chi è dentro adesso.
            </p>
            <div class="tiles">
              <div class="tile">
                <p class="mirada-label">Ingressi registrati</p>
                <p class="mirada-value big">{{ section.totalEntries }}</p>
              </div>
              <div class="tile">
                <p class="mirada-label">Biglietti distinti</p>
                <p class="mirada-value big">{{ section.distinctTickets }}</p>
              </div>
              <div class="tile">
                <p class="mirada-label">Conflitti aperti</p>
                <p class="mirada-value big">{{ section.openConflicts }}</p>
              </div>
            </div>
            @if (section.openConflicts) {
              <p class="mirada-hint">
                Doppi ingressi rilevati in sincronizzazione e <strong>non risolti</strong>: vanno
                dirimiti a mano, il sistema non decide al posto dello staff.
              </p>
            }
            @if (section.bySession.length) {
              <keijo-list-items-wrapper>
                @for (s of section.bySession; track s.sessionId) {
                  <keijo-list-item-wrapper direction="row">
                    <div class="row">
                      <span class="mirada-value">{{ name(s.name) }}</span>
                      <span class="mirada-hint">{{ time(s.startAt) }}</span>
                      <keijo-pill variant="info" [icon]="checkInIcon">
                        {{ s.entries }} ingressi
                      </keijo-pill>
                    </div>
                  </keijo-list-item-wrapper>
                }
              </keijo-list-items-wrapper>
            } @else {
              <p class="mirada-muted">Nessun ingresso registrato: l’evento non è ancora iniziato.</p>
            }
          } @else {
            <app-unavailable-section label="Presenze" [section]="unavailable('attendance')" />
          }
        </keijo-page-section-wrapper>

        <!-- ------------------------------------------------- andamento --->
        <keijo-page-section-wrapper title="Andamento delle iscrizioni">
          @if (trend(); as section) {
            @if (section.points.length) {
              <keijo-list-items-wrapper>
                @for (point of section.points; track point.date) {
                  <keijo-list-item-wrapper direction="row">
                    <div class="row">
                      <keijo-pill variant="default" [icon]="trendIcon">{{ day(point.date) }}</keijo-pill>
                      <span class="mirada-value">{{ point.count }} iscrizioni</span>
                    </div>
                  </keijo-list-item-wrapper>
                }
              </keijo-list-items-wrapper>
            } @else {
              <p class="mirada-hint">Nessuna iscrizione ancora registrata.</p>
            }
            @if (section.note) {
              <p class="mirada-hint">{{ section.note }}</p>
            }
          } @else {
            <app-unavailable-section
              label="Andamento"
              [section]="unavailable('registrationsTrend')"
            />
          }
        </keijo-page-section-wrapper>
      }
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .head,
      .pills,
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
      .tiles {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      }
      .tile {
        border: 1px solid rgba(var(--mirada-ivory), 0.12);
        border-radius: 0.5rem;
        padding: 0.625rem 0.75rem;
      }
      .big {
        font-size: 1.5rem;
        font-weight: 600;
        line-height: 1.2;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly events = inject(EventStore);
  private readonly organizations = inject(OrganizationStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly store = inject(DashboardStore);
  readonly realtime = inject(RealtimeService);

  readonly eventIcon = celebration;
  readonly seatIcon = eventSeat;
  readonly sellIcon = sell;
  readonly balanceIcon = scale;
  readonly warningIcon = warning;
  readonly checklistIcon = checklist;
  readonly trendIcon = trendingUp;
  readonly pendingIcon = howToReg;
  readonly liveIcon = wifi;
  readonly payoutIcon = payments;
  readonly coupleIcon = favorite;
  readonly checkInIcon = howToReg;

  readonly eventControl = new FormControl<number | null>(null);
  private readonly selectable = signal<MiradaEvent[]>([]);
  /** Vero quando nessun evento è in vendita e l'elenco ricade sulle bozze. */
  readonly onlyDrafts = signal(false);

  readonly eventOptions = computed<SelectOption[]>(() =>
    this.selectable().map((ev) => ({
      label: `${i18nPlain(ev.title, this.locale.lang())} — ${formatDate(ev.startAt)}`,
      value: ev.id,
    })),
  );

  readonly selectedEvent = computed(() => {
    const id = this.store.eventId();
    return this.selectable().find((ev) => ev.id === id) ?? null;
  });

  readonly payoutUi = computed(() => {
    const status = this.organizations.payout()?.payoutStatus;
    return status ? PAYOUT_STATUS_UI[status] : null;
  });

  // -- sezioni: `null` significa «non calcolabile», mai «zero» (`RB21`) -----

  readonly roles = computed(() => {
    const section = this.store.section<RegistrationsByRole>('registrationsByRole');
    return isAvailable(section) ? section : null;
  });
  readonly capacity = computed(() => {
    const section = this.store.section<CapacitySection>('capacity');
    return isAvailable(section) ? section : null;
  });
  readonly committed = computed(() => {
    const section = this.store.section<CommittedSection>('committedByTicketType');
    return isAvailable(section) ? section : null;
  });
  readonly sold = computed(() => {
    const section = this.store.section<SoldSection>('soldByTicketType');
    return isAvailable(section) ? section : null;
  });
  /** Quanti titoli sono stati davvero saldati: distingue «zero vendite» da «nessun titolo». */
  readonly soldTotal = computed(() =>
    (this.sold()?.items ?? []).reduce((total, item) => total + item.sold, 0),
  );
  readonly revenue = computed(() => {
    const section = this.store.section<RevenueSection>('netRevenue');
    return isAvailable(section) ? section : null;
  });
  /**
   * La frase sugli ordini saldati, composta qui e non nel template: un `@if`
   * a metà periodo lascia gli spazi del sorgente attorno alla virgola e al
   * punto finale, e in pagina si legge «6 ordini saldati , di cui … .».
   */
  readonly revenueLabel = computed(() => {
    const section = this.revenue();
    if (!section) return '';
    const orders = `${section.paidOrders} ${section.paidOrders === 1 ? 'ordine saldato' : 'ordini saldati'}`;
    if (!section.zeroAmountOrders) return `${orders}.`;
    return (
      `${orders}, di cui ${section.zeroAmountOrders} a importo zero: iscritti veri, ricavo nullo. `
      + 'È la ragione per cui «realmente incassato» può essere inferiore a «pagato dai compratori».'
    );
  });
  readonly attendance = computed(() => {
    const section = this.store.section<AttendanceSection>('attendance');
    return isAvailable(section) ? section : null;
  });
  readonly missingRequirements = computed(() => {
    const section = this.store.section<MissingRequirementsSection>('missingRequirements');
    return isAvailable(section) ? section : null;
  });
  readonly couples = computed(() => {
    const section = this.store.section<CouplesSection>('couples');
    return isAvailable(section) ? section : null;
  });
  readonly requirements = computed(() => {
    const section = this.store.section<RequirementsSection>('requirements');
    return isAvailable(section) ? section : null;
  });
  readonly trend = computed(() => {
    const section = this.store.section<TrendSection>('registrationsTrend');
    return isAvailable(section) ? section : null;
  });

  unavailable(key: string) {
    return unavailableOf(this.store.section<Record<string, unknown>>(key));
  }

  /** Sbilancio **con il segno e la tolleranza a fianco**: `+4 leader (tolleranza 5)`. */
  readonly imbalanceLabel = computed(() => {
    const section = this.roles();
    if (!section) return '';
    return formatImbalance(section.leader, section.follower, section.imbalanceTolerance);
  });

  /** Alla tolleranza il ruolo in eccesso è **«in attesa»**, mai «esaurito». */
  readonly imbalanceAtLimit = computed(() => {
    const section = this.roles();
    if (!section || section.imbalanceTolerance == null) return false;
    return Math.abs(section.imbalance) >= section.imbalanceTolerance;
  });

  readonly heldRoleLabel = computed(() => {
    const section = this.roles();
    if (!section) return '';
    return section.imbalance > 0 ? 'Leader' : 'Follower';
  });

  constructor() {
    this.eventControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      if (id != null) void this.select(id);
    });
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Cruscotto');
    this.registerActions();
    await this.loadSelectable();
    this.subscribeRealtime();
  }

  /**
   * All'ingresso si carica l'elenco degli eventi dell'organizzazione in stato
   * `PUBLISHED | SALES_CLOSED | RUNNING` e si seleziona **il più imminente**
   * (§4.1). Se nessuno è in vendita si ricade sull'elenco completo, dichiarando
   * apertamente il ripiego: un cruscotto vuoto senza spiegazione sembra un
   * guasto.
   */
  private async loadSelectable(): Promise<void> {
    let events = await this.events.loadAll(
      { status: ['PUBLISHED', 'SALES_CLOSED', 'RUNNING'] },
      100,
      '',
    );
    if (!events.length) {
      events = await this.events.loadAll({}, 100, '');
      this.onlyDrafts.set(events.length > 0);
    }
    const sorted = [...events].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
    this.selectable.set(sorted);
    const now = Date.now();
    const imminent = sorted.find((ev) => new Date(ev.startAt).getTime() >= now) ?? sorted[0];
    if (imminent) this.eventControl.setValue(imminent.id, { emitEvent: true });
  }

  private async select(eventId: number): Promise<void> {
    try {
      // Lo store `event` è il contesto corrente condiviso con le altre rotte.
      await this.events.loadOne(eventId);
    } catch {
      /* il gating può negare la lettura singola: il cruscotto resta autonomo */
    }
    await this.refresh(false);
    const organizationId = this.selectable().find((ev) => ev.id === eventId)?.organizationId;
    if (organizationId) {
      try {
        await this.organizations.loadPayoutStatus(organizationId);
      } catch {
        /* lo stato di incasso non è sempre verificabile: la pill semplicemente non compare */
      }
    }
  }

  /**
   * Sottoscrive i tre segnali del §3.9 e **rifà la GET** alla ricezione. Il
   * payload non entra mai nello store: serve solo a decidere se ricaricare.
   */
  private subscribeRealtime(): void {
    const shouldRefresh = (eventId?: number) =>
      eventId === undefined || eventId === this.store.eventId();

    const offs = [
      this.realtime.on(REALTIME_EVENTS.availabilityChanged, (frame) => {
        if (shouldRefresh(frame.payload?.eventId)) void this.store.refresh();
      }),
      this.realtime.on(REALTIME_EVENTS.registrationCreated, (frame) => {
        if (shouldRefresh(frame.payload?.eventId)) void this.store.refresh();
      }),
      this.realtime.on(REALTIME_EVENTS.checkinRegistered, (frame) => {
        if (shouldRefresh(frame.payload?.eventId)) void this.store.refresh();
      }),
    ];
    this.destroyRef.onDestroy(() => offs.forEach((off) => off()));
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.auth.can().eventsWrite) {
      actions.push({
        id: 'create-event',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea un evento',
        run: () => void this.router.navigateByUrl('/events/new'),
      });
    }
    actions.push({
      id: 'refresh',
      icon: sync,
      tooltip: 'Rileggi i dati del cruscotto',
      run: () => void this.refresh(true),
    });
    if (this.auth.can().reports) {
      actions.push({
        id: 'export',
        icon: sell,
        tooltip: 'Esporta il riepilogo dell’evento',
        run: () => void this.router.navigateByUrl('/reports'),
      });
    }
    this.pageActions.set(actions);
  }

  private async refresh(notify: boolean): Promise<void> {
    const id = this.eventControl.value;
    if (id == null) return;
    try {
      await this.store.load(id);
      if (notify) this.toast.show('SUCCESS', 'Cruscotto aggiornato.');
    } catch {
      if (notify) this.toast.show('WARNING', 'Il cruscotto non è al momento leggibile.');
    }
  }

  // -- presentazione --------------------------------------------------------

  statusUi(ev: MiradaEvent) {
    return EVENT_STATUS_UI[ev.status];
  }

  range(ev: MiradaEvent): string {
    return `${formatDate(ev.startAt)} – ${formatDate(ev.endAt)}`;
  }

  /** Accetta anche la stringa ISO: dal JSON le date arrivano così, non come `Date`. */
  time(value: Date | string): string {
    return formatDateTime(value);
  }

  day(value: string): string {
    return formatDate(value);
  }

  /** Gli importi viaggiano in **centesimi interi**: si formattano solo qui (§5). */
  cents(value: number | null | undefined): string {
    return formatCents(value);
  }

  /** I nomi delle entità sono `I18nText`: si mostrano nella lingua corrente. */
  name(value: unknown): string {
    if (value == null) return '—';
    if (typeof value === 'string') return value;
    return i18nPlain(value as I18nText, this.locale.lang());
  }

  /**
   * Le quote **raggruppate per ambito**, nell'ordine in cui un organizzatore le
   * legge: prima l'evento, poi i titoli, le sessioni, i servizi.
   *
   * Ventotto righe di fila che dicono «Sessione 0 / 30 — 30 residui» venti volte
   * non sono un elenco, sono rumore: non si capisce quali siano né se ce ne sia
   * una che non dovrebbe esserci. Raggruppate e nominate, le stesse ventotto
   * righe diventano quattro blocchi leggibili.
   */
  readonly quotaGroups = computed(() => {
    const section = this.capacity();
    if (!section) return [];
    const order: { scope: string; title: string }[] = [
      { scope: 'EVENT', title: 'Evento' },
      { scope: 'TICKET_TYPE', title: 'Titoli d’ingresso' },
      { scope: 'SESSION', title: 'Sessioni' },
      { scope: 'SERVICE', title: 'Servizi accessori' },
    ];
    return order
      .map((g) => ({ ...g, quotas: section.quotas.filter((q) => q.scope === g.scope) }))
      .filter((g) => g.quotas.length);
  });

  /**
   * Il nome della quota. Per l'ambito `EVENT` un nome non esiste — la quota è
   * l'evento stesso — e il qualificatore (ruolo, riservata a…) diventa allora
   * l'unica cosa che la distingue.
   */
  quotaName(quota: CapacityQuotaLine): string {
    if (quota.scopeName != null) {
      const label = this.name(quota.scopeName);
      // Nel programma di un festival la stessa masterclass si ripete su più
      // giorni: senza la data quattro sessioni omonime restano indistinguibili,
      // ed è esattamente il caso dell'ITT.
      return quota.scopeStartAt ? `${label} — ${this.time(quota.scopeStartAt)}` : label;
    }
    if (quota.scope === 'EVENT') return 'Capienza della sala';
    // Un riferimento rimasto orfano: si dice, non si nasconde dietro un id.
    return quota.scopeId !== null ? `(elemento #${quota.scopeId} non trovato)` : '—';
  }

  /** Ruolo e destinazione riservata: ciò che distingue due quote dello stesso oggetto. */
  quotaQualifier(quota: CapacityQuotaLine): string | null {
    const roles: Record<string, string> = { LEADER: 'leader', FOLLOWER: 'follower' };
    const reserved: Record<string, string> = {
      COMPLIMENTARY: 'accrediti',
      EXTERNAL_CHANNEL: 'canali esterni',
    };
    const parts = [
      quota.role ? (roles[quota.role] ?? quota.role) : null,
      quota.reservedFor ? `riservata a ${reserved[quota.reservedFor] ?? quota.reservedFor}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }

  quotaLabel(scope: string, role: string | null, reservedFor: string | null): string {
    const scopes: Record<string, string> = {
      EVENT: 'Evento',
      SESSION: 'Sessione',
      TICKET_TYPE: 'Titolo d’ingresso',
      SERVICE: 'Servizio',
    };
    const roles: Record<string, string> = { LEADER: 'leader', FOLLOWER: 'follower' };
    const reserved: Record<string, string> = {
      COMPLIMENTARY: 'accrediti',
      EXTERNAL_CHANNEL: 'canali esterni',
    };
    return [
      scopes[scope] ?? scope,
      role ? roles[role] ?? role : null,
      reservedFor ? `riservata a ${reserved[reservedFor] ?? reservedFor}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
}
