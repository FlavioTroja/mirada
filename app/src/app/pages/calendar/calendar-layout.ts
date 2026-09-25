import { CalendarItem } from '../../core/domain/calendar';
import { DayKey, addDays, dayKeyOf, firstOfMonth, minuteOfDay, mondayOf } from '../../core/i18n/zoned';

/**
 * Dove va ogni voce sulla griglia. Funzioni pure: nessun segnale, nessun DOM —
 * la griglia le chiama in un `computed` e disegna il risultato.
 */

export const MINUTES_PER_DAY = 1440;
/** Una voce di dieci minuti resta cliccabile: sotto questa altezza non si scende. */
const MIN_BLOCK_MINUTES = 22;

export interface TimedBlock {
  item: CalendarItem;
  /** Minuti dalla mezzanotte, già ritagliati sul giorno. */
  top: number;
  height: number;
  /** Colonna e numero di colonne del gruppo di voci che si sovrappongono. */
  column: number;
  columns: number;
  /** La voce comincia prima di questo giorno o finisce dopo: la milonga 22–02. */
  clippedStart: boolean;
  clippedEnd: boolean;
}

/**
 * Le voci orarie di un giorno, disposte come in Google Calendar: le voci che si
 * sovrappongono si dividono la larghezza, e un gruppo finisce quando una voce
 * comincia dopo la fine di tutte quelle aperte.
 */
export function layoutDay(items: CalendarItem[], day: DayKey): TimedBlock[] {
  const blocks = items
    .filter((item) => !item.band && item.firstDay <= day && item.lastDay >= day)
    .map((item) => {
      const clippedStart = item.firstDay < day;
      const clippedEnd = dayKeyOf(item.endAt) !== day;
      const top = clippedStart ? 0 : minuteOfDay(item.startAt);
      const bottom = clippedEnd ? MINUTES_PER_DAY : minuteOfDay(item.endAt);
      return {
        item,
        top,
        height: Math.max(MIN_BLOCK_MINUTES, bottom - top),
        column: 0,
        columns: 1,
        clippedStart,
        clippedEnd,
      };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);

  let group: TimedBlock[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const block of group) block.columns = columnEnds.length;
    group = [];
    columnEnds = [];
  };

  for (const block of blocks) {
    if (block.top >= groupEnd) close();
    let column = columnEnds.findIndex((end) => end <= block.top);
    if (column < 0) {
      column = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[column] = block.top + block.height;
    block.column = column;
    group.push(block);
    groupEnd = Math.max(groupEnd, block.top + block.height);
  }
  close();
  return blocks;
}

export interface BandBar {
  item: CalendarItem;
  /** Indici di colonna nel periodo visibile, estremi inclusi. */
  from: number;
  to: number;
  row: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Le barre della fascia «tutto il giorno», impilate senza sovrapporsi. */
export function layoutBands(items: CalendarItem[], days: DayKey[]): BandBar[] {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const rows: [number, number][][] = [];

  return items
    .filter((item) => item.band && item.firstDay <= last && item.lastDay >= first)
    .sort((a, b) => a.firstDay.localeCompare(b.firstDay) || b.lastDay.localeCompare(a.lastDay))
    .map((item) => {
      const from = Math.max(0, days.indexOf(item.firstDay < first ? first : item.firstDay));
      const to = days.indexOf(item.lastDay > last ? last : item.lastDay);
      let row = 0;
      while (rows[row]?.some(([a, b]) => !(to < a || from > b))) row++;
      (rows[row] ??= []).push([from, to]);
      return {
        item,
        from,
        to,
        row,
        continuesBefore: item.firstDay < first,
        continuesAfter: item.lastDay > last,
      };
    });
}

/** Le sei settimane della vista mese, dal lunedì che precede il primo del mese. */
export function monthDays(anchor: DayKey): DayKey[] {
  const start = mondayOf(firstOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * Le voci di un giorno per la vista mese: prima le barre, poi quelle che
 * cominciano quel giorno per ora di inizio, e in fondo le code di quelle
 * cominciate il giorno prima — la milonga del venerdì che finisce alle due non
 * deve aprire il sabato con un «22:00».
 */
export function itemsOfDay(items: CalendarItem[], day: DayKey): CalendarItem[] {
  const carried = (item: CalendarItem) => !item.band && item.firstDay < day;
  return items
    .filter((item) => item.firstDay <= day && item.lastDay >= day)
    .sort(
      (a, b) =>
        Number(b.band) - Number(a.band) ||
        Number(carried(a)) - Number(carried(b)) ||
        a.startAt.getTime() - b.startAt.getTime(),
    );
}
