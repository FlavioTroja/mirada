import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CalendarItem } from '../../core/domain/calendar';
import { formatTime } from '../../core/i18n/format';
import { DayKey, weekdayOf } from '../../core/i18n/zoned';
import { MINUTES_PER_DAY, layoutBands, layoutDay } from './calendar-layout';
import { CALENDAR_PALETTE } from './calendar-palette';
import type { CalendarDraft } from './calendar-editor.component';

/** Altezza di un'ora sulla griglia, in pixel. */
const HOUR_PX = 48;
const BAR_PX = 24;
const WEEKDAY_SHORT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

export interface CalendarItemClick {
  item: CalendarItem;
  anchor: DOMRect;
}

/** Uno spazio vuoto scelto con un clic o un trascinamento: dove nasce una voce nuova. */
export interface CalendarSlot {
  day: DayKey;
  /** Minuti dalla mezzanotte di Roma, a passi di mezz'ora. */
  startMinute: number;
  endMinute: number;
  anchor: DOMRect | null;
}

/**
 * **La griglia oraria** delle viste giorno e settimana (`20-calendario.md` §7.1):
 * fascia «tutto il giorno» in alto, ventiquattro ore sotto, voci sovrapposte
 * affiancate, linea dell'ora corrente sul giorno di oggi.
 *
 * Non legge dati e non naviga: riceve le voci già filtrate ed emette il clic,
 * con il rettangolo della voce perché la scheda le si possa ancorare accanto.
 */
@Component({
  selector: 'app-calendar-time-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" [style.--cols]="days().length">
      <div class="head" role="row">
        <div class="gutter"></div>
        @for (day of days(); track day) {
          <button
            type="button"
            class="day-head"
            [class.today]="day === today()"
            [attr.aria-label]="'Apri il giorno ' + day"
            (click)="dayClick.emit(day)"
          >
            <span class="dow">{{ weekday(day) }}</span>
            <span class="num">{{ dayNumber(day) }}</span>
          </button>
        }
      </div>

      <div class="band" [style.height.px]="bandHeight()">
        <div class="gutter band-label">tutto il giorno</div>
        @for (day of days(); track day) {
          <div class="band-cell"></div>
        }
        <div class="bars">
          @for (bar of bars(); track bar.item.key) {
            <button
              type="button"
              class="bar kind-{{ bar.item.kind }}"
              [class.draft]="bar.item.draft"
              [class.cancelled]="bar.item.cancelled"
              [class.from-before]="bar.continuesBefore"
              [class.to-after]="bar.continuesAfter"
              [style.left]="'calc(' + bar.from + ' / var(--cols) * 100% + 2px)'"
              [style.width]="'calc(' + (bar.to - bar.from + 1) + ' / var(--cols) * 100% - 6px)'"
              [style.top.px]="bar.row * (barPx + 2) + 3"
              [attr.aria-label]="bar.item.title"
              (click)="open(bar.item, $event)"
            >
              <span class="title">{{ bar.item.title }}</span>
            </button>
          }
        </div>
      </div>

      <div class="scroll" #scroll>
        <div class="body" [style.height.px]="24 * hourPx">
          <div class="hours" aria-hidden="true">
            @for (hour of hours; track hour) {
              <div class="hour" [style.top.px]="hour * hourPx">{{ hour === 0 ? '' : pad(hour) + ':00' }}</div>
            }
          </div>
          @for (day of days(); track day) {
            <div
              class="col"
              [class.today]="day === today()"
              [class.writable]="writable()"
              (pointerdown)="startSlot($event, day)"
            >
              @if (ghost(); as g) {
                @if (g.day === day) {
                  <div
                    class="ghost"
                    [style.top.px]="(g.startMinute / 60) * hourPx"
                    [style.height.px]="((g.endMinute - g.startMinute) / 60) * hourPx - 2"
                  >
                    {{ clock(g.startMinute) }} – {{ clock(g.endMinute) }}
                  </div>
                }
              } @else if (draft(); as d) {
                @if (d.day === day && !d.allDay) {
                  <div
                    class="draft-block kind-{{ d.kind }}"
                    [style.top.px]="(d.startMinute / 60) * hourPx"
                    [style.height.px]="((d.endMinute - d.startMinute) / 60) * hourPx - 2"
                  >
                    <span class="title">{{ d.title }}</span>
                    <span class="time">{{ clock(d.startMinute) }} – {{ clock(d.endMinute) }}</span>
                  </div>
                }
              }
              @for (block of blocksByDay().get(day); track block.item.key) {
                <button
                  type="button"
                  class="block kind-{{ block.item.kind }}"
                  [class.draft]="block.item.draft"
                  [class.cancelled]="block.item.cancelled"
                  [class.short]="block.height < 45"
                  [style.top.px]="(block.top / 60) * hourPx"
                  [style.height.px]="(block.height / 60) * hourPx - 2"
                  [style.left]="'calc(' + (block.column / block.columns) * 100 + '% + 1px)'"
                  [style.width]="'calc(' + 100 / block.columns + '% - 4px)'"
                  [attr.aria-label]="label(block.item)"
                  (pointerdown)="$event.stopPropagation()"
                  (click)="open(block.item, $event)"
                >
                  <span class="title">
                    @if (block.item.kind === 'openday') {
                      <span class="tag">Open day</span>
                    }
                    {{ block.item.title }}
                  </span>
                  <span class="time">
                    {{ block.clippedStart ? '…' : start(block.item) }} – {{ block.clippedEnd ? '…' : end(block.item) }}
                    @if (block.item.room && block.height >= 60) {
                      · {{ block.item.room }}
                    }
                  </span>
                </button>
              }
              @if (day === today()) {
                <div class="now" [style.top.px]="(nowMinute() / 60) * hourPx" aria-hidden="true"></div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    CALENDAR_PALETTE,
    `
      :host { display: block; }
      .grid { display: flex; flex-direction: column; }
      .head, .band, .body { display: grid; grid-template-columns: 3.5rem repeat(var(--cols), minmax(0, 1fr)); }
      /* La barra di scorrimento della griglia oraria ruba larghezza alle colonne:
         intestazione e fascia alta si riservano lo stesso spazio, o le colonne
         non sono più allineate ai giorni. */
      .head, .band, .scroll { overflow-y: hidden; scrollbar-gutter: stable; }
      .scroll { overflow-y: auto; }
      .head { border-bottom: 1px solid var(--color-default-border); }
      .day-head {
        display: flex; flex-direction: column; align-items: center; gap: 0.125rem;
        padding: 0.5rem 0.25rem; background: none; border: 0; border-left: 1px solid var(--color-default-border);
        color: rgb(var(--text-rgb)); cursor: pointer; font: inherit;
      }
      .day-head:hover .num { background: rgba(var(--text-rgb), 0.06); }
      .dow { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.65; }
      .num {
        font-size: 1.25rem; font-weight: 600; width: 2.25rem; height: 2.25rem; border-radius: 999px;
        display: grid; place-items: center; font-variant-numeric: tabular-nums;
      }
      .day-head.today .dow { color: var(--color-accent); opacity: 1; }
      .day-head.today .num { background: rgb(var(--keijo-accent)); color: rgb(var(--mirada-on-accent)); }

      .band { position: relative; border-bottom: 1px solid var(--color-default-border); min-height: 1.75rem; }
      .band-label { font-size: 0.62rem; line-height: 1.1; opacity: 0.6; text-align: right; padding: 0.3rem 0.4rem 0.3rem 0; }
      .band-cell { border-left: 1px solid var(--color-default-border); }
      .bars { position: absolute; left: 3.5rem; right: 0; top: 0; bottom: 0; pointer-events: none; }
      .bar {
        position: absolute; height: 24px; border-radius: 6px; padding: 0 0.5rem; pointer-events: auto;
        font: inherit; font-size: 0.75rem; font-weight: 600; text-align: left; cursor: pointer;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border: 1px solid transparent;
      }
      .bar.from-before { border-top-left-radius: 0; border-bottom-left-radius: 0; }
      .bar.to-after { border-top-right-radius: 0; border-bottom-right-radius: 0; }

      .scroll { height: min(62vh, 36rem); overflow-y: auto; position: relative; }
      .body { position: relative; }
      .hours { position: relative; }
      .hour {
        position: absolute; right: 0.4rem; transform: translateY(-0.55em);
        font-size: 0.66rem; opacity: 0.6; font-variant-numeric: tabular-nums;
      }
      .col {
        position: relative; border-left: 1px solid var(--color-default-border);
        background-image: repeating-linear-gradient(
          to bottom, transparent 0, transparent 47px, var(--color-default-border) 47px, var(--color-default-border) 48px
        );
      }
      .col.today { background-color: rgba(var(--accent-rgb), 0.035); }
      .col.writable { cursor: cell; touch-action: pan-y; }
      .draft-block {
        position: absolute; left: 2px; right: 6px; z-index: 5; pointer-events: none; overflow: hidden;
        display: flex; flex-direction: column; gap: 0.05rem; border-radius: 7px; padding: 0.2rem 0.4rem;
        font-size: 0.74rem; line-height: 1.25; background: var(--kind); color: var(--kind-ink);
        box-shadow: 0 6px 18px -6px rgba(0, 0, 0, 0.45);
      }
      .draft-block .title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .draft-block .time { opacity: 0.92; font-variant-numeric: tabular-nums; }
      .ghost {
        position: absolute; left: 2px; right: 6px; z-index: 2; pointer-events: none;
        border-radius: 7px; padding: 0.2rem 0.4rem; font-size: 0.74rem; font-weight: 600;
        background: rgba(var(--accent-rgb), 0.14); border: 1.5px solid rgb(var(--keijo-accent));
        color: rgb(var(--text-rgb)); font-variant-numeric: tabular-nums;
      }

      .block {
        position: absolute; border-radius: 7px; padding: 0.2rem 0.4rem; overflow: hidden; text-align: left;
        display: flex; flex-direction: column; gap: 0.05rem; font: inherit; font-size: 0.74rem; line-height: 1.25;
        cursor: pointer; border: 1px solid rgb(var(--foreground-color));
      }
      .block.short { flex-direction: row; gap: 0.35rem; align-items: baseline; }
      .block .title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .block .time { opacity: 0.92; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tag {
        font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
        padding: 0 0.3rem; border-radius: 4px; background: rgba(255, 255, 255, 0.22); margin-right: 0.2rem;
      }

      .bar, .block { background: var(--kind); color: var(--kind-ink); }
      .draft { background: var(--kind-soft); color: rgb(var(--text-rgb)); border: 1.5px dashed var(--kind); }
      .cancelled { opacity: 0.5; }
      .cancelled .title, .cancelled .time { text-decoration: line-through; }
      .bar:focus-visible, .block:focus-visible, .day-head:focus-visible {
        outline: 2px solid rgb(var(--keijo-accent)); outline-offset: 2px; z-index: 4;
      }

      .now { position: absolute; left: 0; right: 0; height: 2px; background: var(--cal-now); z-index: 3; pointer-events: none; }
      .now::before {
        content: ''; position: absolute; left: -6px; top: -5px; width: 12px; height: 12px;
        border-radius: 50%; background: var(--cal-now);
      }

      @media (max-width: 640px) {
        .head, .band, .body { grid-template-columns: 2.75rem repeat(var(--cols), minmax(0, 1fr)); }
        .bars { left: 2.75rem; }
        .num { font-size: 1rem; width: 1.9rem; height: 1.9rem; }
      }
    `,
  ],
})
export class CalendarTimeGridComponent {
  readonly days = input.required<DayKey[]>();
  readonly items = input.required<CalendarItem[]>();
  readonly today = input.required<DayKey>();
  /** Minuti dalla mezzanotte di Roma: la linea rossa. */
  readonly nowMinute = input.required<number>();

  /** Chi può creare: solo allora lo spazio vuoto risponde al clic. */
  readonly writable = input(false);
  /** Il blocco «(Senza titolo)» del popup aperto, se ce n'è uno. */
  readonly draft = input<CalendarDraft | null>(null);

  readonly itemClick = output<CalendarItemClick>();
  readonly dayClick = output<DayKey>();
  readonly slotSelect = output<CalendarSlot>();

  /** Il riquadro che segue il trascinamento, prima che il popup si apra. */
  readonly ghost = signal<{ day: DayKey; startMinute: number; endMinute: number } | null>(null);

  readonly hourPx = HOUR_PX;
  readonly barPx = BAR_PX;
  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  private readonly scroll = viewChild.required<ElementRef<HTMLElement>>('scroll');

  readonly bars = computed(() => layoutBands(this.items(), this.days()));
  readonly bandHeight = computed(() => {
    const rows = this.bars().reduce((max, bar) => Math.max(max, bar.row + 1), 0);
    return Math.max(34, rows * (BAR_PX + 2) + 6);
  });
  readonly blocksByDay = computed(() => new Map(this.days().map((day) => [day, layoutDay(this.items(), day)])));

  constructor() {
    // Si apre sull'ora della prima voce del periodo, un'ora prima: per una
    // scuola di tango la giornata comincia la sera, e una griglia aperta alle
    // otto del mattino mostrerebbe ore vuote. Senza voci, le otto.
    //
    // Quando cambia il periodo — e una volta ancora quando ne arrivano le voci,
    // che la prima volta non ci sono ancora. Poi mai più: chi ha scorso a mano
    // non deve vedersi riportare su a ogni aggiornamento in tempo reale.
    effect(() => {
      const key = this.days().join();
      // Le code delle milonghe iniziate il giorno prima partono da mezzanotte:
      // non sono «la prima cosa della giornata», e non decidono dove aprire.
      const tops = [...this.blocksByDay().values()].flat().filter((b) => !b.clippedStart).map((b) => b.top);
      untracked(() => {
        const newPeriod = key !== this.scrolledFor;
        if (!newPeriod && (this.scrolledWithItems || !tops.length)) return;
        this.scrolledFor = key;
        this.scrolledWithItems = tops.length > 0;
        const target = tops.length ? Math.min(...tops) : 9 * 60;
        const element = this.scroll().nativeElement;
        queueMicrotask(() => {
          element.scrollTop = Math.max(0, ((Math.min(target, MINUTES_PER_DAY) - 60) / 60) * HOUR_PX);
        });
      });
    });
  }

  private scrolledFor: string | null = null;
  private scrolledWithItems = false;

  /**
   * Clic o trascinamento su uno spazio vuoto, come in Google: il clic prende
   * un'ora dalla mezz'ora toccata, il trascinamento l'intervallo percorso.
   * Il popup si apre al rilascio, accanto al riquadro.
   */
  startSlot(event: PointerEvent, day: DayKey): void {
    if (!this.writable() || event.button !== 0) return;
    const column = event.currentTarget as HTMLElement;
    const rect = column.getBoundingClientRect();
    const minuteAt = (clientY: number) =>
      Math.max(0, Math.min(MINUTES_PER_DAY, Math.floor(((clientY - rect.top) / HOUR_PX) * 2) * 30));
    const origin = Math.min(minuteAt(event.clientY), MINUTES_PER_DAY - 30);
    let dragged = false;
    this.ghost.set({ day, startMinute: origin, endMinute: Math.min(origin + 60, MINUTES_PER_DAY) });

    const move = (e: PointerEvent) => {
      const at = Math.min(MINUTES_PER_DAY, minuteAt(e.clientY) + 30);
      if (!dragged && Math.abs(at - 30 - origin) < 30) return;
      dragged = true;
      this.ghost.set(
        at > origin
          ? { day, startMinute: origin, endMinute: at }
          : { day, startMinute: Math.max(0, at - 30), endMinute: origin + 30 },
      );
    };
    const stop = (cancelled: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      const slot = this.ghost();
      if (cancelled || !slot) {
        this.ghost.set(null);
        return;
      }
      // L'àncora si calcola dalla colonna, non dal riquadro disegnato: con un
      // clic veloce il riquadro non è ancora sullo schermo quando il dito si alza.
      const box = column.getBoundingClientRect();
      const anchor = new DOMRect(
        box.left,
        box.top + (slot.startMinute / 60) * HOUR_PX,
        box.width,
        ((slot.endMinute - slot.startMinute) / 60) * HOUR_PX,
      );
      // Da qui in poi il blocco lo disegna il popup, col titolo che si scrive.
      this.ghost.set(null);
      this.slotSelect.emit({ ...slot, anchor });
    };
    const up = () => stop(false);
    const cancel = () => stop(true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    // Su un telefono il dito che scorre la griglia annulla il gesto: non è una scelta.
    window.addEventListener('pointercancel', cancel);
  }

  clock(minute: number): string {
    return `${this.pad(Math.floor(minute / 60))}:${String(minute % 60).padStart(2, '0')}`;
  }

  weekday(day: DayKey): string {
    return WEEKDAY_SHORT[weekdayOf(day) - 1]!;
  }

  dayNumber(day: DayKey): number {
    return +day.slice(8, 10);
  }

  pad(hour: number): string {
    return String(hour).padStart(2, '0');
  }

  start(item: CalendarItem): string {
    return formatTime(item.startAt);
  }

  end(item: CalendarItem): string {
    return formatTime(item.endAt);
  }

  label(item: CalendarItem): string {
    return `${item.title}, ${this.start(item)}–${this.end(item)}${item.cancelled ? ', annullata' : ''}`;
  }

  open(item: CalendarItem, event: MouseEvent): void {
    event.stopPropagation();
    this.itemClick.emit({ item, anchor: (event.currentTarget as HTMLElement).getBoundingClientRect() });
  }
}
