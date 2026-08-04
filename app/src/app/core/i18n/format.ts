/**
 * Formattazione di presentazione (§5).
 *
 *  - **Importi**: sempre in **centesimi interi** lato dati; la formattazione
 *    `it-IT` / `EUR` avviene solo qui, in presentazione.
 *  - **Date**: fuso di riferimento **`Europe/Rome`**.
 */

export const TIMEZONE = 'Europe/Rome';
export const LOCALE = 'it-IT';

const money = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Centesimi interi → `1.234,50 €`. */
export function formatCents(cents: number | null | undefined, empty = '—'): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return empty;
  return money.format(cents / 100);
}

/** `12,50` (senza simbolo) — per i campi di form in euro. */
export function centsToEuroInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

/** `12,50` o `12.50` → 1250 centesimi interi. Mai virgola mobile nei dati. */
export function euroInputToCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const dayFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | Date | null | undefined, empty = '—'): string {
  const date = toDate(value);
  return date ? dateTimeFmt.format(date) : empty;
}

export function formatDate(value: string | Date | null | undefined, empty = '—'): string {
  const date = toDate(value);
  return date ? dateFmt.format(date) : empty;
}

export function formatTime(value: string | Date | null | undefined, empty = '—'): string {
  const date = toDate(value);
  return date ? timeFmt.format(date) : empty;
}

/** «sabato 12 settembre» — intestazione di raggruppamento delle sessioni. */
export function formatDayLabel(value: string | Date | null | undefined, empty = '—'): string {
  const date = toDate(value);
  return date ? dayFmt.format(date) : empty;
}

/** Intervallo compatto: stesso giorno → `12/09/2026 21:00 – 02:00`. */
export function formatRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  const from = toDate(start);
  const to = toDate(end);
  if (!from) return '—';
  if (!to) return dateTimeFmt.format(from);
  const sameDay = dateFmt.format(from) === dateFmt.format(to);
  return sameDay
    ? `${dateFmt.format(from)} ${timeFmt.format(from)} – ${timeFmt.format(to)}`
    : `${dateTimeFmt.format(from)} – ${dateTimeFmt.format(to)}`;
}

/** `Date` → stringa ISO per il backend. `null` resta `null`. */
export function toIso(value: Date | string | null | undefined): string | null {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

/** Stringa ISO → `Date` per i `keijo-datetime-picker`. */
export function toDateValue(value: string | Date | null | undefined): Date | null {
  return toDate(value);
}

/** Sbilancio con il **segno** e la tolleranza a fianco: `+4 leader (tolleranza 5)`. */
export function formatImbalance(
  leaders: number,
  followers: number,
  tolerance?: number | null,
): string {
  const delta = leaders - followers;
  if (delta === 0) return tolerance ? `in pari (tolleranza ${tolerance})` : 'in pari';
  const sign = delta > 0 ? '+' : '−';
  const role = delta > 0 ? 'leader' : 'follower';
  const base = `${sign}${Math.abs(delta)} ${role}`;
  return tolerance ? `${base} (tolleranza ${tolerance})` : base;
}
