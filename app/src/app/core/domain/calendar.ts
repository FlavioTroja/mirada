import { EventStatus } from './enums';
import { SessionKind } from './models';
import { I18nText, UiLang, i18nPlain } from '../i18n/i18n-text';
import { DayKey, dayKeyOf } from '../i18n/zoned';

/**
 * Il calendario dell'organizzatore — `20-calendario.md`.
 *
 * Tre letture (`POST /sessions/calendar`, `/events/calendar`,
 * `/appointments/calendar`) e una sola forma per la griglia: `CalendarItem`.
 * La griglia non sa che cosa sia una sessione o un appuntamento; sa di blocchi
 * orari, di barre «tutto il giorno», di colori e di dove porta un clic.
 */

interface VenueRef {
  id: number;
  name: string;
}

export interface CalendarSessionRow {
  id: number;
  eventId: number;
  name: I18nText;
  startAt: string;
  endAt: string;
  room: string | null;
  level: string | null;
  kind: SessionKind;
  seriesId: string | null;
  isImplicit: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
  event: {
    id: number;
    organizationId: number;
    title: I18nText;
    status: EventStatus;
    cancelledAt: string | null;
    venue: VenueRef | null;
    eventType: { family: 'EVENT' | 'COURSE'; sessionsLabel: I18nText | null };
  };
}

export interface CalendarEventRow {
  id: number;
  organizationId: number;
  title: I18nText;
  startAt: string;
  endAt: string;
  status: EventStatus;
  cancelledAt: string | null;
  venue: VenueRef | null;
}

export interface CalendarAppointmentRow {
  id: number;
  organizationId: number;
  title: string;
  note: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  room: string | null;
  seriesId: string | null;
  venue: VenueRef | null;
}

/** Le quattro categorie delle chip-legenda, nell'ordine in cui compaiono. */
export type CalendarKind = 'lesson' | 'openday' | 'event' | 'appointment';

export const CALENDAR_KINDS: { kind: CalendarKind; label: string }[] = [
  { kind: 'lesson', label: 'Lezioni' },
  { kind: 'openday', label: 'Open day' },
  { kind: 'event', label: 'Eventi' },
  { kind: 'appointment', label: 'Appuntamenti' },
];

export interface CalendarItem {
  /** Unica fra le tre sorgenti: `s12`, `e4`, `a7`. */
  key: string;
  kind: CalendarKind;
  title: string;
  /** Di chi è: il corso di una lezione, il festival di una sessione. Nullo per un appuntamento. */
  parentTitle: string | null;
  startAt: Date;
  endAt: Date;
  /** Nella fascia alta: eventi su più giorni e appuntamenti «tutto il giorno». */
  band: boolean;
  /** Primo e ultimo giorno toccati, per le barre e per la vista mese. */
  firstDay: DayKey;
  lastDay: DayKey;
  draft: boolean;
  cancelled: boolean;
  cancellationReason: string | null;
  room: string | null;
  venue: string | null;
  note: string | null;
  seriesId: string | null;
  /** Dove porta la pill del corso o dell'evento. Nullo = nessun collegamento. */
  link: { label: string; path: string } | null;
  /** Da quale riga viene: è ciò che la modifica e l'eliminazione devono toccare. */
  ref: CalendarRef;
}

export type CalendarRef =
  | {
      type: 'session';
      id: number;
      eventId: number;
      /** Lezione od open day di un corso, invece che sessione di un festival. */
      course: boolean;
      /** La sessione implicita di una milonga singola: non si elimina, si sposta. */
      isImplicit: boolean;
      name: I18nText;
    }
  | { type: 'event'; id: number }
  | { type: 'appointment'; id: number; allDay: boolean };

/** L'ultimo giorno toccato: una fine a mezzanotte appartiene al giorno prima. */
function lastDayOf(startAt: Date, endAt: Date): DayKey {
  const end = endAt.getTime() > startAt.getTime() ? new Date(endAt.getTime() - 1) : endAt;
  return dayKeyOf(end);
}

function base(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return { startAt: start, endAt: end, firstDay: dayKeyOf(start), lastDay: lastDayOf(start, end) };
}

export function sessionToItem(row: CalendarSessionRow, lang: UiLang): CalendarItem {
  const course = row.event.eventType.family === 'COURSE';
  const eventTitle = i18nPlain(row.event.title, lang);
  const sessionName = i18nPlain(row.name, lang);
  const kind: CalendarKind = course ? (row.kind === 'OPEN_DAY' ? 'openday' : 'lesson') : 'event';
  return {
    key: `s${row.id}`,
    kind,
    // Una lezione si riconosce dal corso («Principianti»), una sessione di
    // festival dal proprio nome («Milonga di gala»). La sessione implicita di
    // una milonga singola non ha un nome suo: prende quello dell'evento.
    title: course || row.isImplicit ? eventTitle : sessionName,
    parentTitle: course ? sessionName : row.isImplicit ? null : eventTitle,
    ...base(row.startAt, row.endAt),
    band: false,
    draft: row.event.status === 'DRAFT',
    cancelled: !!row.cancelledAt || !!row.event.cancelledAt || row.event.status === 'CANCELLED',
    cancellationReason: row.cancellationReason,
    room: row.room,
    venue: row.event.venue?.name ?? null,
    note: null,
    seriesId: row.seriesId,
    link: {
      label: eventTitle,
      path: course ? `/courses/${row.eventId}/sessions` : `/events/${row.eventId}/sessions`,
    },
    ref: {
      type: 'session',
      id: row.id,
      eventId: row.eventId,
      course,
      isImplicit: row.isImplicit,
      name: row.name,
    },
  };
}

/** Un evento va nella fascia alta solo se dura almeno un giorno: una milonga 21–02 no. */
const BAND_MIN_MS = 24 * 3_600_000;

export function eventToItem(row: CalendarEventRow, lang: UiLang): CalendarItem | null {
  const times = base(row.startAt, row.endAt);
  if (times.endAt.getTime() - times.startAt.getTime() < BAND_MIN_MS) return null;
  const title = i18nPlain(row.title, lang);
  return {
    key: `e${row.id}`,
    kind: 'event',
    title,
    parentTitle: null,
    ...times,
    band: true,
    draft: row.status === 'DRAFT',
    cancelled: !!row.cancelledAt || row.status === 'CANCELLED',
    cancellationReason: null,
    room: null,
    venue: row.venue?.name ?? null,
    note: null,
    seriesId: null,
    link: { label: title, path: `/events/${row.id}` },
    ref: { type: 'event', id: row.id },
  };
}

export function appointmentToItem(row: CalendarAppointmentRow): CalendarItem {
  return {
    key: `a${row.id}`,
    kind: 'appointment',
    title: row.title,
    parentTitle: null,
    ...base(row.startAt, row.endAt),
    band: row.allDay,
    draft: false,
    cancelled: false,
    cancellationReason: null,
    room: row.room,
    venue: row.venue?.name ?? null,
    note: row.note,
    seriesId: row.seriesId,
    link: null,
    ref: { type: 'appointment', id: row.id, allDay: row.allDay },
  };
}
