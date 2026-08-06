import { I18nText } from '../domain/models';

/**
 * Presentazione — **l'unico posto** in cui i centesimi diventano euro e in cui
 * una data UTC diventa un'ora di Trani.
 *
 * §3.1: gli importi sono **centesimi interi** nei dati; la formattazione
 * `it-IT` / `EUR` è solo di presentazione. §5: fuso `Europe/Rome`.
 */

const TZ = 'Europe/Rome';

const EUR = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const EUR_COMPACT = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Centesimi → «145,00 €». */
export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return EUR.format(cents / 100);
}

/** Centesimi → «145 €» quando i decimali sono zero, altrimenti per esteso. */
export function moneyShort(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return cents % 100 === 0 ? EUR_COMPACT.format(cents / 100) : EUR.format(cents / 100);
}

function fmt(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', { timeZone: TZ, ...opts }).format(d);
}

/** «14 giugno 2027» */
export function dayLong(iso: string | null | undefined): string {
  return fmt(iso, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** «lunedì 14 giugno» */
export function weekdayDay(iso: string | null | undefined): string {
  return fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** «14 giu 2027» */
export function dayShort(iso: string | null | undefined): string {
  return fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** «20:00» */
export function time(iso: string | null | undefined): string {
  return fmt(iso, { hour: '2-digit', minute: '2-digit' });
}

/** «14 giu 2027, 20:00» */
export function dayTime(iso: string | null | undefined): string {
  return fmt(iso, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Chiave di raggruppamento per giorno nel fuso di riferimento: `2027-06-14`. */
export function dayKey(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
  return parts;
}

/**
 * Intervallo dell'evento in una riga: «dal 14 giugno all'11 luglio 2027», e
 * «14 giugno 2027» quando comincia e finisce lo stesso giorno.
 */
export function dateRange(startIso: string, endIso: string): string {
  if (!startIso) return '';
  if (!endIso || dayKey(startIso) === dayKey(endIso)) return dayLong(startIso);
  const sameYear = fmt(startIso, { year: 'numeric' }) === fmt(endIso, { year: 'numeric' });
  const start = sameYear ? fmt(startIso, { day: 'numeric', month: 'long' }) : dayLong(startIso);
  return `dal ${start} al ${dayLong(endIso)}`;
}

/** Durata residua in `mm:ss`, mai negativa. */
export function countdown(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ───────────────────────────────────────────────────────────────────────────
// `I18nText` (§3.5, `RF-PUB-10`)
// ───────────────────────────────────────────────────────────────────────────

/** Etichette delle lingue che il contenuto può dichiarare. */
const LANGUAGE_LABEL: Record<string, string> = {
  it: 'italiano',
  en: 'inglese',
  es: 'spagnolo',
  fr: 'francese',
  de: 'tedesco',
};

export interface ResolvedText {
  /** Il testo da mostrare: **mai** una stringa vuota se un originale esiste. */
  text: string;
  /** La lingua effettivamente mostrata. */
  lang: string;
  /**
   * `true` quando la lingua chiesta non c'era e si mostra l'originale: in questo
   * caso l'interfaccia **deve** dichiarare la lingua (`RF-PUB-10`).
   */
  fallback: boolean;
  /** «italiano», per la dicitura «testo in italiano — traduzione non disponibile». */
  langLabel: string;
}

/**
 * Risolve un `I18nText` nella lingua chiesta. In assenza della traduzione si
 * mostra **l'originale con l'indicazione della lingua**, mai una stringa vuota.
 */
export function resolveText(value: I18nText | null | undefined, wanted = 'it'): ResolvedText {
  const empty: ResolvedText = { text: '', lang: wanted, fallback: false, langLabel: '' };
  if (!value) return empty;

  const preferred = value[wanted];
  if (preferred && preferred.trim()) {
    return { text: preferred, lang: wanted, fallback: false, langLabel: label(wanted) };
  }

  for (const [lang, text] of Object.entries(value)) {
    if (text && text.trim()) {
      return { text, lang, fallback: true, langLabel: label(lang) };
    }
  }
  return empty;
}

/** Solo il testo, per i punti in cui non c'è spazio per la dicitura di lingua. */
export function text(value: I18nText | null | undefined, wanted = 'it'): string {
  return resolveText(value, wanted).text;
}

function label(lang: string): string {
  return LANGUAGE_LABEL[lang] ?? lang;
}

// ───────────────────────────────────────────────────────────────────────────
// Etichette di dominio — tabella vincolante del §1
// ───────────────────────────────────────────────────────────────────────────

/** Leader / Follower — **mai** «uomo/donna» (`RB6`). */
export const ROLE_LABEL: Record<string, string> = {
  LEADER: 'Leader',
  FOLLOWER: 'Follower',
  FLEXIBLE: 'Ruolo flessibile',
};

export const ARTIST_KIND_LABEL: Record<string, string> = {
  TEACHER: 'Maestri',
  DJ: 'DJ',
  ORCHESTRA: 'Orchestre',
};

export const SALE_UNIT_LABEL: Record<string, string> = {
  PER_PERSON: 'per persona',
  PER_COUPLE: 'per coppia',
};
