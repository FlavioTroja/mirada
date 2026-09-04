import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  ButtonComponent,
  CheckboxComponent,
  InfoBoxComponent,
  ListItemsSkeletonComponent,
  ListItemWrapperComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SectionActionButton,
} from '@keijo/ui';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { close, nightlife, playlistAdd, save, warning } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { Session, TicketTypeSession } from '../../core/domain/models';
import { formatDayLabel, formatRange } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { EventStore } from '../../stores/event.store';
import { sessionsLabelOf } from './event-family';
import { SessionStore } from '../../stores/session.store';
import { TicketTypeStore } from '../../stores/ticket-type.store';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { EventWorkspaceNavComponent } from './event-workspace-nav.component';

interface QuickSelector {
  id: string;
  label: string;
  match: (session: Session) => boolean;
}

/**
 * `/events/:id/ticket-types/:ttId/sessions` — **elenco esplicito** delle sessioni
 * incluse nel titolo (§4.2).
 *
 * I selettori rapidi (*tutti i workshop*, *tutto il sabato*, *tutte le
 * milonghe*) producono comunque un **elenco esplicito e modificabile, mai una
 * regola**: la potenza sta nell'editor, non nel modello.
 *
 * Il salvataggio è **un solo `PATCH /ticket-types/:id/sessions` con l'array
 * intero**: `id: -1` marca una riga nuova, `toBeDisconnected: true` una rimossa.
 */
@Component({
  selector: 'app-ticket-type-sessions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ListItemsWrapperComponent,
    ListItemWrapperComponent,
    ListItemsSkeletonComponent,
    ButtonComponent,
    CheckboxComponent,
    PillComponent,
    InfoBoxComponent,
    I18nTextComponent,
    EventWorkspaceNavComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-event-workspace-nav [event]="eventStore.current()" current="ticket-types" />

      <keijo-page-section-wrapper [title]="sessionsLabel() + ' incluse in ' + ticketTypeName()">
        <p class="mirada-hint">
          L’elenco è esplicito: ogni sessione inclusa è una riga. I selettori rapidi qui sotto
          compilano l’elenco, non lo sostituiscono con una regola — dopo averli usati puoi
          togliere o aggiungere quello che vuoi.
        </p>

        <div class="quick">
          @for (selector of quickSelectors; track selector.id) {
            <keijo-button
              variant="default"
              [icon]="quickIcon"
              [label]="selector.label"
              (action)="applySelector(selector)"
            />
          }
          <keijo-button
            variant="error"
            [icon]="clearIcon"
            label="Svuota"
            (action)="clearAll()"
          />
        </div>
      </keijo-page-section-wrapper>

      <keijo-page-section-wrapper mode="plain">
        <keijo-info-box [icon]="warningIcon" title="Aggiungere sì, togliere no" variant="info">
          <span>
            Su un titolo già venduto l’aggiunta di una sessione è ammessa — è una miglioria per
            chi ha già comprato — mentre la rimozione non lo è mai: sarebbe una sottrazione a chi
            ha pagato. Il conteggio dei biglietti già emessi arriverà con l’entità
            <strong>Ticket</strong>, che il contratto API non espone ancora.
          </span>
        </keijo-info-box>
      </keijo-page-section-wrapper>

      <keijo-page-section-wrapper mode="plain">
        @if (loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (day of grouped(); track day.label) {
              <keijo-list-item-wrapper direction="column">
                <p class="mirada-label">{{ day.label }}</p>
                @for (session of day.sessions; track session.id) {
                  <div class="row">
                    <keijo-checkbox
                      [formControl]="controlFor(session.id)"
                      [label]="''"
                    />
                    <div class="row-body">
                      <span class="title"><app-i18n-text [value]="session.name" /></span>
                      <span class="mirada-muted">{{ range(session) }}</span>
                    </div>
                    <div class="row-badges">
                      @if (session.room) {
                        <keijo-pill variant="default" [icon]="sessionIcon">{{
                          session.room
                        }}</keijo-pill>
                      }
                      @if (session.cancelledAt) {
                        <keijo-pill variant="error" [icon]="warningIcon">annullata</keijo-pill>
                      }
                    </div>
                  </div>
                }
              </keijo-list-item-wrapper>
            } @empty {
              <keijo-info-box [icon]="sessionIcon" title="Nessuna sessione" variant="info">
                <span>
                  L’evento non ha ancora sessioni da includere: aggiungile dalla scheda
                  {{ sessionsLabel() }}
                  del workspace.
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
      .quick {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.25rem 0;
      }
      .row-body {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }
      .row-badges {
        display: flex;
        gap: 0.375rem;
        flex-wrap: wrap;
      }
      .title {
        font-weight: 600;
      }
    `,
  ],
})
export class TicketTypeSessionsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly sessions = inject(SessionStore);
  private readonly ticketTypes = inject(TicketTypeStore);

  readonly eventStore = inject(EventStore);

  /** «Lezioni» in un corso, «Sessioni» in un festival: la parola è del tipo. */
  readonly sessionsLabel = computed(() =>
    sessionsLabelOf(this.eventStore.current()?.eventType, this.locale.lang()),
  );

  readonly sessionIcon = nightlife;
  readonly quickIcon = playlistAdd;
  readonly clearIcon = close;
  readonly warningIcon = warning;

  private readonly eventId = signal(0);
  private readonly ticketTypeId = signal(0);
  readonly loading = signal(true);

  /** Righe già presenti sul server, per costruire il `PATCH` con l'array intero. */
  private readonly existing = signal<TicketTypeSession[]>([]);
  private readonly allSessions = signal<Session[]>([]);
  private readonly controls = new Map<number, FormControl<boolean>>();

  readonly ticketTypeName = computed(() =>
    i18nPlain(this.ticketTypes.current()?.name, this.locale.lang(), 'questo titolo'),
  );

  readonly grouped = computed(() => {
    const byDay = new Map<string, Session[]>();
    for (const session of this.allSessions()) {
      const label = formatDayLabel(session.startAt);
      const bucket = byDay.get(label);
      if (bucket) bucket.push(session);
      else byDay.set(label, [session]);
    }
    return [...byDay.entries()].map(([label, sessions]) => ({ label, sessions }));
  });

  readonly quickSelectors: QuickSelector[] = [
    {
      id: 'workshops',
      label: 'Tutti i workshop',
      match: (s) => matchesName(s, ['workshop', 'seminario', 'lezione', 'class']),
    },
    {
      id: 'milongas',
      label: 'Tutte le milonghe',
      match: (s) => matchesName(s, ['milonga', 'práctica', 'practica', 'pratica']),
    },
    {
      id: 'saturday',
      label: 'Tutto il sabato',
      match: (s) => formatDayLabel(s.startAt).toLowerCase().startsWith('sabato'),
    },
    {
      id: 'sunday',
      label: 'Tutta la domenica',
      match: (s) => formatDayLabel(s.startAt).toLowerCase().startsWith('domenica'),
    },
    { id: 'all', label: 'Tutte', match: () => true },
  ];

  async ngOnInit(): Promise<void> {
    // Ripiego finché il tipo non è noto; la parola vera si mette dopo il carico.
    this.headerTitle.set('Sessioni incluse');
    this.eventId.set(Number(this.route.snapshot.paramMap.get('id')));
    this.ticketTypeId.set(Number(this.route.snapshot.paramMap.get('ttId')));
    this.registerActions();

    const [, ticketType, sessions] = await Promise.all([
      this.eventStore.loadOne(this.eventId()),
      this.ticketTypes.loadOne(this.ticketTypeId(), 'sessions'),
      this.sessions.loadAll({ eventId: this.eventId() }, 300, ''),
    ]);

    // La parola vera adesso che il tipo è noto: «Lezioni incluse» in un corso.
    this.headerTitle.set(`${this.sessionsLabel()} incluse`);

    this.allSessions.set(sessions);
    const rows = ticketType.sessions ?? [];
    this.existing.set(rows);
    for (const session of sessions) {
      const included = rows.some((r) => r.sessionId === session.id);
      this.controls.set(session.id, new FormControl(included, { nonNullable: true }));
    }
    this.loading.set(false);
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.auth.can().eventsWrite) {
      actions.push({
        id: 'save',
        icon: save,
        label: 'Salva',
        tooltip: 'Salva l’elenco delle sessioni incluse',
        run: () => void this.save(),
      });
    }
    this.pageActions.set(actions);
  }

  controlFor(sessionId: number): FormControl<boolean> {
    let control = this.controls.get(sessionId);
    if (!control) {
      control = new FormControl(false, { nonNullable: true });
      this.controls.set(sessionId, control);
    }
    return control;
  }

  range(session: Session): string {
    return formatRange(session.startAt, session.endAt);
  }

  applySelector(selector: QuickSelector): void {
    for (const session of this.allSessions()) {
      if (selector.match(session)) this.controlFor(session.id).setValue(true);
    }
  }

  clearAll(): void {
    for (const session of this.allSessions()) {
      this.controlFor(session.id).setValue(false);
    }
  }

  /**
   * Un solo `PATCH` con l'array intero: le righe già presenti conservano il loro
   * `id`, quelle nuove viaggiano con `id: -1`, quelle tolte con
   * `toBeDisconnected: true` (§3.2).
   */
  async save(): Promise<void> {
    const rows: TicketTypeSession[] = [];
    const existing = this.existing();

    for (const session of this.allSessions()) {
      const checked = this.controlFor(session.id).value;
      const row = existing.find((r) => r.sessionId === session.id);
      if (checked && !row) {
        rows.push({ id: -1, sessionId: session.id });
      } else if (checked && row) {
        rows.push({ id: row.id, sessionId: session.id });
      } else if (!checked && row) {
        rows.push({ id: row.id, sessionId: session.id, toBeDisconnected: true });
      }
    }

    await this.ticketTypes.saveSessions(this.ticketTypeId(), rows);
    const refreshed = await this.ticketTypes.loadOne(this.ticketTypeId(), 'sessions');
    this.existing.set(refreshed.sessions ?? []);
    this.toast.show('SUCCESS', 'Elenco delle sessioni incluse salvato.');
  }
}

function matchesName(session: Session, needles: string[]): boolean {
  const text = `${session.name?.it ?? ''} ${session.name?.en ?? ''}`.toLowerCase();
  return needles.some((needle) => text.includes(needle));
}
