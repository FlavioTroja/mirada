import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
} from '@keijo/ui';
import {
  add,
  cancel as cancelIcon,
  check,
  checkCircle,
  close,
  edit,
  iconDelete,
  meetingRoom,
  nightlife,
  scale,
  star,
  warning,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { OrphanSessionResolution, Session } from '../../core/domain/models';
import { formatRange, toIso } from '../../core/i18n/format';
import { LocaleService, buildI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { sessionsLabelOf } from './event-family';
import { EventStore } from '../../stores/event.store';
import { SessionStore } from '../../stores/session.store';
import { TicketTypeStore } from '../../stores/ticket-type.store';
import { ConfirmService } from '../../shared/confirm.service';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { EventWorkspaceNavComponent } from './event-workspace-nav.component';

/**
 * `/events/:id/sessions` — le sessioni dell'evento (§4.2).
 *
 * Due comportamenti che non sono di comodo:
 *  - **Sessione orfana** (`RF-EVT-24`): aggiungendo una sessione a evento
 *    pubblicato si segnalano i titoli che non la includono, **distinguendo i
 *    venduti dagli invenduti**. Sui venduti l'aggiunta è ammessa solo come
 *    miglioria: l'interfaccia non offre nemmeno l'opzione di togliere.
 *  - **Annullamento di una sessione** (`RF-EVT-35`): richiede motivazione,
 *    mostra quanti titoli la includono e con quale peso di ripartizione, e
 *    rilascia le quote della sessione.
 */
@Component({
  selector: 'app-event-sessions',
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
    DateTimePickerComponent,
    I18nTextComponent,
    EventWorkspaceNavComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-event-workspace-nav [event]="eventStore.current()" current="sessions" />

      @if (orphan(); as report) {
        <keijo-page-section-wrapper mode="plain">
        <keijo-info-box
          [icon]="warningIcon"
          title="Sessione non inclusa in alcuni titoli d’ingresso"
          variant="warning"
        >
          <span>
            L’evento è già pubblicato. Questi titoli non includono la nuova sessione:
            @for (row of report.ticketTypesWithoutSession; track row.id) {
              <strong>{{ nameOf(row.name) }}</strong>
              <span>
                ({{ row.sold ? row.issuedTicketCount + ' biglietti già emessi' : 'nessuna vendita' }})
              </span>
            }
            Sui titoli già venduti l’aggiunta è ammessa solo come miglioria: si aggiunge la
            sessione dall’elenco delle sessioni incluse del titolo, e non è mai possibile
            toglierne una.
          </span>
        </keijo-info-box>
        </keijo-page-section-wrapper>
      }

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica sessione' : 'Nuova sessione'"
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
                id="nameIt"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.nameEn"
                label="nome (inglese)"
                id="nameEn"
                type="text"
              />
            </keijo-form-row>
            @if (err('nameIt'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="2">
              <keijo-datetime-picker
                [formControl]="form.controls.startAt"
                label="inizio"
                id="sessionStartAt"
              />
              <keijo-datetime-picker
                [formControl]="form.controls.endAt"
                label="fine"
                id="sessionEndAt"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="3">
              <keijo-input [formControl]="form.controls.room" label="sala" id="room" type="text" />
              <keijo-input
                [formControl]="form.controls.level"
                label="livello"
                id="level"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.allocationWeight"
                label="peso di ripartizione"
                id="allocationWeight"
                type="number"
                min="1"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              Il peso di ripartizione stabilisce quanta parte del valore di un titolo appartiene a
              questa sessione: serve a comunicare correttamente chi è coinvolto se la sessione
              viene annullata.
            </p>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      @if (cancellingId() !== null) {
        <keijo-page-section-wrapper
          title="Annullamento della sessione"
          [buttons]="cancelButtons"
          (buttonClick)="onCancelAction($event)"
        >
          <p class="mirada-hint">
            {{ cancelImpact() }}
            L’annullamento rilascia le quote di capienza della sessione. La motivazione è
            obbligatoria e viene usata per comunicare ai soli interessati.
          </p>
          <keijo-form-wrapper [formGroup]="cancelForm">
            <keijo-form-row [cols]="1">
              <keijo-input
                [formControl]="cancelForm.controls.reason"
                label="motivazione"
                id="sessionCancelReason"
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
            @for (session of store.items(); track session.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title"><app-i18n-text [value]="session.name" /></span>
                    <span class="mirada-muted">{{ range(session) }}</span>
                  </div>
                </ng-template>

                <ng-template #secondary>
                  <div class="secondary">
                    @if (session.cancelledAt) {
                      <keijo-pill
                        variant="error"
                        [icon]="cancelIcon"
                        [tooltip]="session.cancellationReason ?? 'Sessione annullata'"
                      >
                        Annullata
                      </keijo-pill>
                    } @else {
                      <keijo-pill variant="success" [icon]="activeIcon">Attiva</keijo-pill>
                    }
                    @if (session.room) {
                      <keijo-pill variant="default" [icon]="roomIcon">{{ session.room }}</keijo-pill>
                    }
                    @if (session.level) {
                      <keijo-pill variant="default" [icon]="levelIcon">{{
                        session.level
                      }}</keijo-pill>
                    }
                    <keijo-pill
                      variant="default"
                      [icon]="weightIcon"
                      tooltip="Peso di ripartizione del valore del titolo su questa sessione"
                    >
                      peso {{ session.allocationWeight }}
                    </keijo-pill>
                    @if (session.isImplicit) {
                      <keijo-pill
                        variant="info"
                        [icon]="sessionIcon"
                        tooltip="Sessione creata dal sistema per gli eventi senza sessioni multiple"
                      >
                        implicita
                      </keijo-pill>
                    }
                  </div>
                </ng-template>

                <ng-template #actions>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Elimina la sessione"
                      (action)="remove(session)"
                    />
                    @if (!session.cancelledAt) {
                      <keijo-button
                        variant="error"
                        [icon]="cancelIcon"
                        tooltip="Annulla la sessione"
                        (action)="startCancel(session)"
                      />
                    }
                    <keijo-button
                      variant="warning"
                      [icon]="editIcon"
                      tooltip="Modifica la sessione"
                      (action)="startEdit(session)"
                    />
                  }
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="sessionIcon" title="Nessuna sessione" variant="info">
                <span>
                  Workshop, milonghe e spettacoli si aggiungono qui. Ogni titolo d’ingresso porta
                  poi l’elenco esplicito delle sessioni che include.
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
export class EventSessionsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly ticketTypes = inject(TicketTypeStore);

  readonly store = inject(SessionStore);
  readonly eventStore = inject(EventStore);

  readonly sessionIcon = nightlife;
  readonly roomIcon = meetingRoom;
  readonly levelIcon = star;
  readonly weightIcon = scale;
  readonly activeIcon = checkCircle;
  readonly cancelIcon = cancelIcon;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;
  readonly warningIcon = warning;

  private readonly eventId = signal(0);
  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly cancellingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly orphan = signal<OrphanSessionResolution | null>(null);
  readonly cancelImpact = signal('');

  readonly canWrite = computed(() => this.auth.can().eventsWrite);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];
  readonly cancelButtons: SectionActionButton[] = [
    { id: 'confirm', icon: cancelIcon, label: 'Annulla sessione', variant: 'error' },
    { id: 'abort', icon: close, label: 'Non annullare', variant: 'default' },
  ];

  readonly form = new FormGroup({
    nameIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nameEn: new FormControl('', { nonNullable: true }),
    startAt: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    endAt: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    room: new FormControl('', { nonNullable: true }),
    level: new FormControl('', { nonNullable: true }),
    allocationWeight: new FormControl<number>(1, { nonNullable: true }),
  });

  readonly cancelForm = new FormGroup({
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async ngOnInit(): Promise<void> {
    // Il ripiego prima del caricamento: la testata non deve restare vuota nel
    // frattempo, e «Sessioni» è ciò che il sistema ha sempre detto.
    this.headerTitle.set('Sessioni');
    this.eventId.set(Number(this.route.snapshot.paramMap.get('id')));
    this.registerActions();
    await Promise.all([
      this.eventStore.loadOne(this.eventId()),
      this.store.replaceQuery({ eventId: this.eventId(), includeCancelled: true }),
    ]);
    // E la parola vera quando il tipo è noto: «Lezioni» dentro un corso.
    this.headerTitle.set(this.sessionsLabel());
  }

  /** Come si chiamano qui le sessioni — la parola viene dal catalogo. */
  readonly sessionsLabel = computed(() =>
    sessionsLabelOf(this.eventStore.current()?.eventType, this.locale.lang()),
  );

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite()) {
      actions.push({
        id: 'create',
        icon: add,
        label: 'Aggiungi',
        tooltip: 'Aggiungi una sessione',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  range(session: Session): string {
    return formatRange(session.startAt, session.endAt);
  }

  nameOf(value: unknown): string {
    return i18nPlain(value as never, this.locale.lang());
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({ allocationWeight: 1, nameIt: '', nameEn: '', room: '', level: '' });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(session: Session): void {
    this.editingId.set(session.id);
    this.form.reset({
      nameIt: session.name?.it ?? '',
      nameEn: session.name?.en ?? '',
      startAt: session.startAt ? new Date(session.startAt) : null,
      endAt: session.endAt ? new Date(session.endAt) : null,
      room: session.room ?? '',
      level: session.level ?? '',
      allocationWeight: session.allocationWeight ?? 1,
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
      this.formErrors.set(['Nome, inizio e fine sono obbligatori.']);
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      eventId: this.eventId(),
      name: buildI18n(value.nameIt, value.nameEn),
      startAt: toIso(value.startAt),
      endAt: toIso(value.endAt),
      room: value.room.trim() || null,
      level: value.level.trim() || null,
      allocationWeight: Number(value.allocationWeight) || 1,
    };

    try {
      const id = this.editingId();
      if (id === null) {
        const created = await this.store.create(payload);
        this.toast.show('SUCCESS', 'Sessione aggiunta.');
        await this.checkOrphan(created.id);
      } else {
        const { eventId: _eventId, ...patch } = payload;
        await this.store.update(id, patch);
        this.toast.show('SUCCESS', 'Sessione aggiornata.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  /**
   * Evento già pubblicato: la sessione appena aggiunta può essere «orfana» per
   * alcuni titoli. Il servizio distingue i venduti dagli invenduti (`RF-EVT-24`).
   */
  private async checkOrphan(sessionId: number): Promise<void> {
    const ev = this.eventStore.current();
    if (!ev || ev.status === 'DRAFT') {
      this.orphan.set(null);
      return;
    }
    try {
      const report = await this.eventStore.resolveOrphanSession(ev.id, sessionId);
      this.orphan.set(report.ticketTypesWithoutSession.length ? report : null);
    } catch {
      this.orphan.set(null);
    }
  }

  async startCancel(session: Session): Promise<void> {
    this.cancellingId.set(session.id);
    this.cancelForm.reset();
    const including = await this.countTicketTypesIncluding();
    this.cancelImpact.set(
      including === null
        ? `La sessione ha peso di ripartizione ${session.allocationWeight}.`
        : `Nell’evento ci sono ${including} titoli d’ingresso; questa sessione pesa ` +
          `${session.allocationWeight} nella ripartizione.`,
    );
  }

  private async countTicketTypesIncluding(): Promise<number | null> {
    try {
      const rows = await this.ticketTypes.loadAll({ eventId: this.eventId() }, 200, '');
      return rows.length;
    } catch {
      return null;
    }
  }

  async onCancelAction(button: SectionActionButton): Promise<void> {
    const id = this.cancellingId();
    if (button.id === 'abort' || id === null) {
      this.cancellingId.set(null);
      return;
    }
    this.cancelForm.markAllAsTouched();
    if (this.cancelForm.invalid) return;

    await this.store.cancelSession(id, this.cancelForm.controls.reason.value.trim());
    this.cancellingId.set(null);
    this.toast.show('SUCCESS', 'Sessione annullata: le sue quote sono state rilasciate.');
    await this.store.load();
  }

  async remove(session: Session): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare la sessione?',
      message:
        'La sessione sparisce dall’evento e dagli elenchi dei titoli che la includono. ' +
        'Se l’evento è già in vendita, l’operazione corretta è l’annullamento con motivazione, ' +
        'non l’eliminazione.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(session.id);
    this.toast.show('SUCCESS', 'Sessione eliminata.');
  }
}
