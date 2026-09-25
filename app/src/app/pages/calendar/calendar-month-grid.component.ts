import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CalendarItem } from '../../core/domain/calendar';
import { formatTime } from '../../core/i18n/format';
import { DayKey } from '../../core/i18n/zoned';
import { itemsOfDay, monthDays } from './calendar-layout';
import { CALENDAR_PALETTE } from './calendar-palette';
import { CalendarItemClick, CalendarSlot } from './calendar-time-grid.component';

const WEEKDAY_SHORT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
/** Voci per giorno prima del «+N altri»: tre, come Google, perché la cella resti leggibile. */
const VISIBLE_PER_DAY = 3;

/**
 * **Il mese** (`20-calendario.md` §7.1): sei righe, fino a tre voci per giorno e
 * «+N altri», che apre quel giorno. Il numero del giorno apre il giorno.
 */
@Component({
  selector: 'app-calendar-month-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head" aria-hidden="true">
      @for (label of weekdays; track label) {
        <div>{{ label }}</div>
      }
    </div>
    <div class="cells">
      @for (cell of cells(); track cell.day) {
        <div
          class="cell"
          [class.out]="!cell.inMonth"
          [class.today]="cell.day === today()"
          [class.writable]="writable()"
          (click)="pickDay($event, cell.day)"
        >
          <button
            type="button"
            class="num"
            [attr.aria-label]="'Apri il giorno ' + cell.day"
            (click)="dayClick.emit(cell.day)"
          >
            {{ +cell.day.slice(8, 10) }}
          </button>
          @for (item of cell.shown; track item.key) {
            <button
              type="button"
              class="item kind-{{ item.kind }}"
              [class.band]="item.band"
              [class.draft]="item.draft"
              [class.cancelled]="item.cancelled"
              [attr.aria-label]="item.title"
              (click)="open(item, $event)"
            >
              @if (!item.band) {
                <span class="dot"></span>
                @if (item.firstDay === cell.day) {
                  <span class="time">{{ time(item) }}</span>
                } @else {
                  <span class="time" title="Continua dal giorno prima">…</span>
                }
              }
              <span class="title">{{ item.title }}</span>
            </button>
          }
          @if (cell.more > 0) {
            <button type="button" class="more" (click)="dayClick.emit(cell.day)">+{{ cell.more }} altri</button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    CALENDAR_PALETTE,
    `
      :host { display: block; }
      .head, .cells { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
      .head div {
        font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
        opacity: 0.65; text-align: center; padding: 0.5rem 0;
      }
      .cell {
        min-height: 7rem; min-width: 0; padding: 0.25rem; display: flex; flex-direction: column; gap: 0.125rem;
        border-top: 1px solid var(--color-default-border); border-left: 1px solid var(--color-default-border);
      }
      .cell:nth-child(7n + 1) { border-left: 0; }
      .cell.writable { cursor: cell; }
      .num {
        align-self: center; width: 1.7rem; height: 1.7rem; border-radius: 999px; border: 0; background: none;
        font: inherit; font-size: 0.8rem; font-weight: 600; color: rgb(var(--text-rgb)); cursor: pointer;
        font-variant-numeric: tabular-nums;
      }
      .num:hover { background: rgba(var(--text-rgb), 0.06); }
      .cell.out .num { opacity: 0.45; }
      .cell.today .num { background: rgb(var(--keijo-accent)); color: rgb(var(--mirada-on-accent)); }

      .item {
        display: flex; align-items: center; gap: 0.3rem; min-width: 0; width: 100%;
        border: 0; border-radius: 5px; padding: 0.1rem 0.3rem; background: none; cursor: pointer;
        font: inherit; font-size: 0.72rem; color: rgb(var(--text-rgb)); text-align: left;
      }
      .item:hover { background: rgba(var(--text-rgb), 0.06); }
      .item.band { background: var(--kind); color: var(--kind-ink); font-weight: 600; }
      .item.band.draft { background: var(--kind-soft); color: rgb(var(--text-rgb)); outline: 1.5px dashed var(--kind); outline-offset: -1.5px; }
      .dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--kind); flex: none; }
      .item.draft .dot { background: transparent; box-shadow: inset 0 0 0 2px var(--kind); }
      .time { opacity: 0.7; font-variant-numeric: tabular-nums; flex: none; }
      .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cancelled { opacity: 0.5; }
      .cancelled .title { text-decoration: line-through; }
      .more {
        border: 0; background: none; cursor: pointer; text-align: left; padding: 0.1rem 0.3rem;
        font: inherit; font-size: 0.72rem; font-weight: 600; color: rgb(var(--text-rgb)); opacity: 0.7;
      }
      .more:hover { opacity: 1; }
      .item:focus-visible, .num:focus-visible, .more:focus-visible { outline: 2px solid rgb(var(--keijo-accent)); outline-offset: 1px; }

      @media (max-width: 640px) {
        .cell { min-height: 4.75rem; }
        .time { display: none; }
      }
    `,
  ],
})
export class CalendarMonthGridComponent {
  /** Un giorno qualunque del mese da mostrare. */
  readonly anchor = input.required<DayKey>();
  readonly items = input.required<CalendarItem[]>();
  readonly today = input.required<DayKey>();

  readonly writable = input(false);

  readonly itemClick = output<CalendarItemClick>();
  readonly dayClick = output<DayKey>();
  readonly slotSelect = output<CalendarSlot>();

  readonly weekdays = WEEKDAY_SHORT;

  readonly cells = computed(() => {
    const month = this.anchor().slice(0, 7);
    return monthDays(this.anchor()).map((day) => {
      const all = itemsOfDay(this.items(), day);
      const shown = all.slice(0, all.length > VISIBLE_PER_DAY ? VISIBLE_PER_DAY - 1 : VISIBLE_PER_DAY);
      return { day, inMonth: day.startsWith(month), shown, more: all.length - shown.length };
    });
  });

  /**
   * Un clic sul vuoto di un giorno propone una voce in quel giorno. Nel mese non
   * c'è un'ora da cui partire: si propone la sera, quando una scuola di tango
   * fa lezione — l'orario si corregge nel popup.
   */
  pickDay(event: MouseEvent, day: DayKey): void {
    if (!this.writable()) return;
    event.stopPropagation();
    this.slotSelect.emit({
      day,
      startMinute: 20 * 60 + 30,
      endMinute: 22 * 60,
      anchor: (event.currentTarget as HTMLElement).getBoundingClientRect(),
    });
  }

  time(item: CalendarItem): string {
    return formatTime(item.startAt);
  }

  open(item: CalendarItem, event: MouseEvent): void {
    event.stopPropagation();
    this.itemClick.emit({ item, anchor: (event.currentTarget as HTMLElement).getBoundingClientRect() });
  }
}
