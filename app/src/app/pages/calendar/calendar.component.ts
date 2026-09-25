import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ButtonComponent,
  ChipComponent,
  InfoBoxComponent,
  ModalComponent,
  ModalDialogData,
  ModalRef,
  ModalService,
  PageSectionWrapperComponent,
  PageWrapperComponent,
} from '@keijo/ui';
import {
  add,
  chevronLeft,
  chevronRight,
  close,
  eventRepeat,
  iconDelete,
  today as todayIcon,
  warning,
} from '@keijo/ui/icons';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/api/api-error';
import { PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../shared/confirm.service';
import { HeaderTitleService } from '../../services/header-title.service';
import { CALENDAR_KINDS, CalendarItem, CalendarKind } from '../../core/domain/calendar';
import { LOCALE, TIMEZONE } from '../../core/i18n/format';
import {
  DayKey,
  addDays,
  addMonths,
  fromWallClock,
  isDayKey,
  minuteOfDay,
  mondayOf,
  todayKey,
} from '../../core/i18n/zoned';
import { liveOn } from '../../core/realtime/live';
import { REALTIME_EVENTS } from '../../core/realtime/realtime.service';
import { CalendarStore, SeriesScope } from '../../stores/calendar.store';
import { monthDays } from './calendar-layout';
import { CALENDAR_PALETTE } from './calendar-palette';
import { CalendarItemClick, CalendarSlot, CalendarTimeGridComponent } from './calendar-time-grid.component';
import { CalendarDraft, CalendarEditorComponent, EditorRequest } from './calendar-editor.component';
import { CalendarMonthGridComponent } from './calendar-month-grid.component';
import { CalendarItemCardComponent } from './calendar-item-card.component';

type CalendarView = 'day' | 'week' | 'month';

const VIEWS: { view: CalendarView; label: string; key: string }[] = [
  { view: 'day', label: 'Giorno', key: 'g' },
  { view: 'week', label: 'Settimana', key: 's' },
  { view: 'month', label: 'Mese', key: 'm' },
];

/** Sotto questa larghezza la settimana ha colonne da un dito: si parte dal giorno. */
const NARROW_PX = 768;
/** Più segnali ravvicinati — una serie di dodici lezioni — sono una sola rilettura. */
const REFRESH_COALESCE_MS = 400;

const monthFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, month: 'long', year: 'numeric' });
const monthOnlyFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, month: 'long' });
const dayFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * `/calendar` — il calendario dell'organizzatore (`20-calendario.md` §7).
 *
 * Lezioni, open day, sessioni ed eventi, appuntamenti dello staff sulla stessa
 * griglia, nelle viste giorno, settimana e mese. Il periodo sta nell'URL
 * (`?view=week&date=2026-09-29`): ricaricare, tornare indietro o mandare il
 * collegamento a un collaboratore riapre la stessa settimana.
 *
 * **In tempo reale**: quando un collaboratore cambia qualcosa nel periodo
 * visibile, il segnale `calendar/changed` fa rileggere la griglia.
 */
@Component({
  selector: 'app-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ButtonComponent,
    ChipComponent,
    InfoBoxComponent,
    CalendarTimeGridComponent,
    CalendarMonthGridComponent,
    CalendarItemCardComponent,
    CalendarEditorComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <keijo-page-section-wrapper mode="plain">
        <div class="toolbar">
          <keijo-button
            [icon]="todayIcon"
            label="Oggi"
            tooltip="Torna a oggi (t)"
            (action)="goToday()"
          />
          <div class="arrows">
            <keijo-button [icon]="prevIcon" tooltip="Periodo precedente (←)" (action)="step(-1)" />
            <keijo-button [icon]="nextIcon" tooltip="Periodo successivo (→)" (action)="step(1)" />
          </div>
          <h2 class="period" aria-live="polite">{{ periodLabel() }}</h2>
          @if (store.loading()) {
            <span class="loading" aria-hidden="true"></span>
          }
          <div class="views" role="radiogroup" aria-label="Vista">
            @for (option of views; track option.view) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="view() === option.view"
                [attr.title]="option.label + ' (' + option.key + ')'"
                (click)="setView(option.view)"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </div>

        <div class="legend" role="group" aria-label="Che cosa mostrare">
          @for (entry of kinds; track entry.kind) {
            <keijo-chip [selected]="shown().has(entry.kind)" (toggle)="toggleKind(entry.kind)">
              <span class="chip-content">
                <span class="dot kind-{{ entry.kind }}" [class.off]="!shown().has(entry.kind)"></span>
                {{ entry.label }}
              </span>
            </keijo-chip>
          }
        </div>

        @if (store.missing().length) {
          <keijo-info-box
            variant="warning"
            [icon]="warningIcon"
            title="Il calendario è incompleto"
          >
            Non è stato possibile leggere: {{ store.missing().join(', ') }}. Riprova tra poco.
          </keijo-info-box>
        }
      </keijo-page-section-wrapper>

      <keijo-page-section-wrapper>
        <div class="surface">
          @if (view() === 'month') {
            <app-calendar-month-grid
              [anchor]="anchor()"
              [items]="visibleItems()"
              [today]="today()"
              [writable]="canWrite()"
              (itemClick)="openCard($event)"
              (dayClick)="openDay($event)"
              (slotSelect)="openCreate($event)"
            />
          } @else {
            <app-calendar-time-grid
              [days]="days()"
              [items]="visibleItems()"
              [today]="today()"
              [nowMinute]="nowMinute()"
              [writable]="canWrite()"
              [draft]="draft()"
              (itemClick)="openCard($event)"
              (dayClick)="openDay($event)"
              (slotSelect)="openCreate($event)"
            />
          }
        </div>
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>

    @if (card(); as open) {
      <div
        #card
        class="card-layer"
        role="dialog"
        [attr.aria-label]="open.item.title"
        [style.left.px]="open.left"
        [style.top.px]="open.top"
      >
        <app-calendar-item-card
          [item]="open.item"
          [canWrite]="canWrite()"
          (closed)="closeCard()"
          (navigate)="follow($event)"
          (edit)="editItem(open.item, open.left, open.top)"
          (remove)="removeItem(open.item)"
        />
      </div>
    }

    @if (editor(); as open) {
      <div
        class="editor-layer"
        role="dialog"
        aria-label="Nuova voce del calendario"
        [style.left.px]="open.left"
        [style.top.px]="open.top"
      >
        <app-calendar-editor
          [request]="open.request"
          (draft)="draft.set($event)"
          (finished)="onSaved($event)"
          (cancelled)="closeEditor()"
        />
      </div>
    }
  `,
  styles: [
    CALENDAR_PALETTE,
    `
      :host { display: block; }
      .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; }
      .arrows { display: flex; gap: 0.25rem; }
      .period { margin: 0; font-size: 1.2rem; font-weight: 600; min-width: 10ch; }
      /* Maiuscola solo in testa: in italiano mesi e giorni vanno in minuscolo. */
      .period::first-letter { text-transform: uppercase; }
      .loading {
        width: 1rem; height: 1rem; border-radius: 50%;
        border: 2px solid rgba(var(--text-rgb), 0.15); border-top-color: rgb(var(--keijo-accent));
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .loading { animation: none; } }

      .views {
        margin-left: auto; display: inline-flex; border: 1px solid var(--mirada-control-border);
        border-radius: 999px; overflow: hidden;
      }
      .views button {
        font: inherit; font-size: 0.85rem; font-weight: 600; padding: 0.4rem 0.9rem;
        border: 0; background: transparent; color: rgb(var(--text-rgb)); cursor: pointer;
      }
      .views button + button { border-left: 1px solid var(--mirada-control-border); }
      .views button[aria-checked='true'] { background: rgb(var(--keijo-accent)); color: rgb(var(--mirada-on-accent)); }
      .views button:focus-visible { outline: 2px solid rgb(var(--keijo-accent)); outline-offset: -3px; }

      .legend { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
      .chip-content { display: inline-flex; align-items: center; gap: 0.45rem; }
      .dot { width: 0.65rem; height: 0.65rem; border-radius: 50%; background: var(--kind); }
      .dot.off { background: transparent; box-shadow: inset 0 0 0 2px var(--kind); }

      .surface { margin: -0.25rem; }

      .card-layer { position: fixed; z-index: 60; }
      .editor-layer { position: fixed; z-index: 70; }

      @media (max-width: 640px) {
        .views { margin-left: 0; }
        .period { font-size: 1.05rem; flex-basis: 100%; order: -1; }
      }
    `,
  ],
})
export class CalendarComponent implements OnInit {
  readonly store = inject(CalendarStore);
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly auth = inject(AuthService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly modal = inject(ModalService);

  /** Creare e modificare: chi costruisce corsi ed eventi. La porta e la cassa leggono. */
  readonly canWrite = computed(() => this.auth.can().calendarWrite);
  readonly editor = signal<{ request: EditorRequest; left: number; top: number } | null>(null);
  readonly draft = signal<CalendarDraft | null>(null);

  readonly todayIcon = todayIcon;
  readonly prevIcon = chevronLeft;
  readonly nextIcon = chevronRight;
  readonly warningIcon = warning;
  readonly views = VIEWS;
  readonly kinds = CALENDAR_KINDS;

  readonly view = signal<CalendarView>('week');
  readonly anchor = signal<DayKey>(todayKey());
  readonly today = signal<DayKey>(todayKey());
  readonly nowMinute = signal(minuteOfDay(new Date()));
  readonly shown = signal<Set<CalendarKind>>(new Set(CALENDAR_KINDS.map((k) => k.kind)));
  readonly card = signal<{ item: CalendarItem; left: number; top: number } | null>(null);

  private readonly cardElement = viewChild<ElementRef<HTMLElement>>('card');

  /** I giorni della griglia: uno, sette, o le sei settimane del mese. */
  readonly days = computed<DayKey[]>(() => {
    switch (this.view()) {
      case 'day':
        return [this.anchor()];
      case 'week': {
        const monday = mondayOf(this.anchor());
        return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
      }
      case 'month':
        return monthDays(this.anchor());
    }
  });

  readonly visibleItems = computed(() => {
    const shown = this.shown();
    return this.store.items().filter((item) => shown.has(item.kind));
  });

  readonly periodLabel = computed(() => {
    const days = this.days();
    const first = fromWallClock(days[0]!, 12);
    const last = fromWallClock(days[days.length - 1]!, 12);
    switch (this.view()) {
      case 'day':
        return dayFmt.format(first);
      case 'month':
        return monthFmt.format(fromWallClock(this.anchor(), 12));
      case 'week':
        return monthOnlyFmt.format(first) === monthOnlyFmt.format(last)
          ? monthFmt.format(first)
          : `${monthOnlyFmt.format(first)} – ${monthFmt.format(last)}`;
    }
  });

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Il periodo cambia → si rilegge e si aggiorna l'URL. Un effetto solo, così
    // le due cose non possono andare fuori passo.
    effect(() => {
      const days = this.days();
      const view = this.view();
      const anchor = this.anchor();
      untracked(() => {
        this.closeCard();
        this.closeEditor();
        void this.store.load(fromWallClock(days[0]!), fromWallClock(addDays(days[days.length - 1]!, 1)));
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { view, date: anchor },
          replaceUrl: true,
        });
      });
    });

    // In tempo reale: si rilegge solo se il periodo toccato interseca quello
    // visibile. Chi guarda un'altra settimana non ricarica nulla.
    liveOn([REALTIME_EVENTS.calendarChanged], (frame) => {
      const { from, to } = frame.payload ?? {};
      if (from && to && !this.store.overlapsRange(new Date(from), new Date(to))) return;
      if (this.refreshTimer) return;
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        void this.store.reload();
      }, REFRESH_COALESCE_MS);
    });

    // La linea dell'ora corrente, e il giorno di oggi a mezzanotte.
    const clock = setInterval(() => {
      this.nowMinute.set(minuteOfDay(new Date()));
      this.today.set(todayKey());
    }, 60_000);
    this.destroyRef.onDestroy(() => {
      clearInterval(clock);
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
    });
  }

  ngOnInit(): void {
    this.headerTitle.set('Calendario');
    if (this.canWrite()) {
      this.pageActions.set([
        {
          id: 'new',
          icon: add,
          label: 'Nuovo',
          tooltip: 'Nuova lezione, open day, appuntamento o evento',
          run: () => this.openCreate(this.defaultSlot()),
        },
      ]);
    }
    const params = this.route.snapshot.queryParamMap;
    const view = params.get('view');
    const date = params.get('date');
    if (view === 'day' || view === 'week' || view === 'month') {
      this.view.set(view);
    } else if (window.innerWidth < NARROW_PX) {
      this.view.set('day');
    }
    if (isDayKey(date)) this.anchor.set(date);
  }

  setView(view: CalendarView): void {
    this.view.set(view);
  }

  step(direction: 1 | -1): void {
    const anchor = this.anchor();
    switch (this.view()) {
      case 'day':
        this.anchor.set(addDays(anchor, direction));
        break;
      case 'week':
        this.anchor.set(addDays(anchor, 7 * direction));
        break;
      case 'month':
        this.anchor.set(addMonths(anchor, direction));
        break;
    }
  }

  goToday(): void {
    this.anchor.set(todayKey());
  }

  openDay(day: DayKey): void {
    this.anchor.set(day);
    this.view.set('day');
  }

  toggleKind(kind: CalendarKind): void {
    const next = new Set(this.shown());
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    this.shown.set(next);
  }

  /** La scheda si apre accanto alla voce, a destra se c'è posto, altrimenti a sinistra. */
  openCard({ item, anchor }: CalendarItemClick): void {
    const width = Math.min(352, window.innerWidth - 32);
    const height = this.canWrite() ? 320 : 260;
    const gap = 8;
    let left = anchor.right + gap;
    if (left + width > window.innerWidth - 16) left = anchor.left - width - gap;
    if (left < 16) left = Math.max(16, (window.innerWidth - width) / 2);
    const top = Math.max(16, Math.min(anchor.top, window.innerHeight - height - 16));
    this.card.set({ item, left, top });
    // L'altezza vera si conosce solo disegnata: se la scheda esce dallo schermo
    // la si alza, invece di lasciare fuori i pulsanti.
    afterNextRender(
      () => {
        const element = this.cardElement()?.nativeElement;
        const open = this.card();
        if (!element || !open) return;
        const overflow = element.getBoundingClientRect().bottom - (window.innerHeight - 16);
        if (overflow > 0) this.card.set({ ...open, top: Math.max(16, open.top - overflow) });
      },
      { injector: this.injector },
    );
  }

  closeCard(): void {
    if (this.card()) this.card.set(null);
  }

  follow(path: string): void {
    this.closeCard();
    void this.router.navigateByUrl(path);
  }

  // ── Scrivere dal calendario (`20-calendario.md` §7.2–7.3) ──────────────

  /** «Nuovo» dalla testata: oggi alla prossima mezz'ora, se oggi è visibile; altrimenti la sera del primo giorno. */
  private defaultSlot(): CalendarSlot {
    const today = this.today();
    if (this.days().includes(today)) {
      const next = Math.min(Math.ceil((this.nowMinute() + 1) / 30) * 30, 22 * 60 + 30);
      return { day: today, startMinute: next, endMinute: Math.min(next + 60, 24 * 60 - 1), anchor: null };
    }
    return { day: this.days()[0]!, startMinute: 20 * 60 + 30, endMinute: 22 * 60, anchor: null };
  }

  openCreate(slot: CalendarSlot): void {
    this.closeCard();
    const request: EditorRequest = { mode: 'create', day: slot.day, startMinute: slot.startMinute, endMinute: slot.endMinute };
    this.editor.set({ request, ...this.placeEditor(slot.anchor) });
  }

  closeEditor(): void {
    this.editor.set(null);
    this.draft.set(null);
  }

  onSaved(message: string): void {
    this.closeEditor();
    if (message) this.toast.show('SUCCESS', message);
  }

  async editItem(item: CalendarItem, left: number, top: number): Promise<void> {
    this.closeCard();
    const scope = item.seriesId ? await this.askScope('edit') : 'ONE';
    if (!scope) return;
    this.editor.set({
      request: { mode: 'edit', item, scope },
      ...this.placeEditor(new DOMRect(left, top, 0, 0)),
    });
  }

  async removeItem(item: CalendarItem): Promise<void> {
    this.closeCard();
    const ref = item.ref;
    if (ref.type === 'event') return;
    const base = ref.type === 'session' ? 'sessions' : 'appointments';

    let scope: 'ONE' | SeriesScope | null = 'ONE';
    if (item.seriesId) {
      scope = await this.askScope('delete');
    } else {
      const ok = await this.confirm.ask({
        title: 'Eliminare questa voce?',
        message: `«${item.title}» sparisce dal calendario.` + (ref.type === 'session'
          ? ' Chi ha già un titolo d’ingresso che la comprende non la vedrà più fra le sessioni incluse.'
          : ''),
        confirmLabel: 'Elimina',
        destructive: true,
      });
      scope = ok ? 'ONE' : null;
    }
    if (!scope) return;

    try {
      if (scope === 'ONE') {
        await this.store.deleteOne(base, ref.id);
        this.toast.show('SUCCESS', 'Voce eliminata.');
        return;
      }
      const result = await this.store.deleteSeries(base, ref.id, scope);
      const skipped = [
        result.skippedPast ? `${result.skippedPast} già passate` : '',
        result.skippedWithCheckIns ? `${result.skippedWithCheckIns} con ingressi registrati` : '',
      ].filter(Boolean);
      this.toast.show(
        'SUCCESS',
        `${result.deleted === 1 ? 'Eliminata 1 voce' : `Eliminate ${result.deleted} voci`}.`
          + (skipped.length ? ` Restano ${skipped.join(' e ')}: la storia non si cancella.` : ''),
      );
    } catch (err) {
      this.toast.show('ERROR', err instanceof ApiError ? err.message : 'Non è stato possibile eliminare.');
    }
  }

  /**
   * «Solo questa · questa e le successive · tutte», come Google, prima di
   * modificare o eliminare una voce che fa parte di una serie.
   */
  private async askScope(action: 'edit' | 'delete'): Promise<'ONE' | SeriesScope | null> {
    let chosen: 'ONE' | SeriesScope | null = null;
    const destructive = action === 'delete';
    const pick = (scope: 'ONE' | SeriesScope) => (): void => {
      chosen = scope;
      ref.close(true);
    };
    const ref: ModalRef<boolean> = this.modal.open<ModalDialogData, boolean>(ModalComponent, {
      backdropClass: 'blur-filter',
      data: {
        title: destructive ? 'Eliminare la voce ricorrente?' : 'Modificare la voce ricorrente?',
        content: destructive
          ? 'Le voci già passate e le lezioni con ingressi registrati non vengono eliminate.'
          : 'Cambiano ora, durata, nome e sala. Il giorno di una serie non si sposta.',
        buttons: [
          { iconName: close, label: 'Annulla', onClick: (): void => ref.close(false) },
          { iconName: destructive ? iconDelete : eventRepeat, label: 'Solo questa', onClick: pick('ONE') },
          { iconName: eventRepeat, label: 'Questa e le successive', onClick: pick('FOLLOWING') },
          {
            iconName: destructive ? iconDelete : eventRepeat,
            label: 'Tutte',
            bgColor: destructive ? 'remove' : 'confirm',
            onClick: pick('ALL'),
          },
        ],
      },
    });
    await ref.afterClosed();
    return chosen;
  }

  /** Accanto allo spazio scelto, a destra se c'è posto; senza àncora, al centro. */
  private placeEditor(anchor: DOMRect | null): { left: number; top: number } {
    const width = Math.min(448, window.innerWidth - 32);
    const height = 480;
    if (!anchor || window.innerWidth < 640) {
      return { left: Math.max(16, (window.innerWidth - width) / 2), top: Math.max(16, (window.innerHeight - height) / 3) };
    }
    const gap = 12;
    let left = anchor.right + gap;
    if (left + width > window.innerWidth - 16) left = anchor.left - width - gap;
    if (left < 16) left = Math.max(16, (window.innerWidth - width) / 2);
    const top = Math.max(16, Math.min(anchor.top - 40, window.innerHeight - height - 16));
    return { left, top };
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // Con il popup aperto le lettere si scrivono, non cambiano vista.
    if (this.editor()) {
      if (event.key === 'Escape') this.closeEditor();
      return;
    }
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

    switch (event.key) {
      case 'Escape':
        this.closeCard();
        return;
      case 't':
        this.goToday();
        break;
      case 'g':
        this.setView('day');
        break;
      case 's':
        this.setView('week');
        break;
      case 'm':
        this.setView('month');
        break;
      case 'ArrowLeft':
        this.step(-1);
        break;
      case 'ArrowRight':
        this.step(1);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  /** Un clic fuori dalla scheda la chiude; uno scorrimento anche, perché resterebbe staccata dalla voce. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const element = this.cardElement()?.nativeElement;
    if (element && !element.contains(event.target as Node)) this.closeCard();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    this.closeCard();
  }
}
