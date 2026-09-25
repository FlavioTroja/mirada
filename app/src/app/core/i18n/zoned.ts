import { TIMEZONE } from './format';

/**
 * **Il giorno e l'ora della scuola**, qualunque sia il fuso del browser.
 *
 * Le etichette dell'applicazione sono già forzate su `Europe/Rome`
 * (`format.ts`). La griglia del calendario deve ragionare nello stesso fuso:
 * se decidesse in quale colonna e a che altezza mettere una lezione con l'ora
 * del browser, un organizzatore in trasferta a Lisbona vedrebbe la lezione
 * delle 20:30 disegnata alle 19:30 con scritto «20:30» sopra.
 *
 * Nessuna libreria: `Intl` sa già dire l'ora di Roma di un istante, e il
 * contrario si ottiene correggendo una stima con lo scarto misurato.
 *
 * Un giorno è una **chiave** `AAAA-MM-GG`: confrontabile come stringa, e senza
 * l'ambiguità di un `Date` che è sempre un istante e mai un giorno.
 */

export type DayKey = string;

export interface WallClock {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  /** ISO: lunedì = 1 … domenica = 7. */
  weekday: number;
}

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** L'ora d'orologio di Roma di un istante. */
export function wallClock(value: Date | string): WallClock {
  const parts = partsFmt.formatToParts(typeof value === 'string' ? new Date(value) : value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    year: +get('year'),
    month: +get('month'),
    day: +get('day'),
    hour: +get('hour') % 24,
    minute: +get('minute'),
    weekday: WEEKDAYS[get('weekday')] ?? 1,
  };
}

/** Quanti millisecondi Roma è avanti a UTC in quell'istante (+1h d'inverno, +2h d'estate). */
function offsetAt(instant: number): number {
  const w = wallClock(new Date(instant));
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  return asUtc - Math.floor(instant / 60_000) * 60_000;
}

/** L'istante in cui a Roma l'orologio segna quel giorno e quell'ora. */
export function fromWallClock(day: DayKey, hour = 0, minute = 0): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const first = guess - offsetAt(guess);
  // Una seconda misura corregge la stima nelle ore a cavallo del cambio d'ora.
  return new Date(guess - offsetAt(first));
}

/** Il giorno di Roma di un istante. */
export function dayKeyOf(value: Date | string): DayKey {
  const w = wallClock(value);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** Minuti dalla mezzanotte di Roma — l'altezza sulla griglia oraria. */
export function minuteOfDay(value: Date | string): number {
  const w = wallClock(value);
  return w.hour * 60 + w.minute;
}

/** Aritmetica sui giorni di calendario: indipendente dal fuso, perché lo è la chiave. */
export function addDays(day: DayKey, n: number): DayKey {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Lunedì = 1 … domenica = 7, del giorno di calendario. */
export function weekdayOf(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

export function mondayOf(day: DayKey): DayKey {
  return addDays(day, -(weekdayOf(day) - 1));
}

export function firstOfMonth(day: DayKey): DayKey {
  return `${day.slice(0, 7)}-01`;
}

export function addMonths(day: DayKey, n: number): DayKey {
  const [y, m] = day.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-01`;
}

export function todayKey(): DayKey {
  return dayKeyOf(new Date());
}

export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
