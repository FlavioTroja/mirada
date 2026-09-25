import { I18nText } from '../i18n/i18n-text';
import { EventDashboard } from './dashboard';

/**
 * `GET /dashboard/today` e `GET /dashboard/activity` — `21-dashboard.md`.
 * La forma è quella del backend (`DashboardTodayDTO`), date come stringhe ISO.
 */
export interface TodaySession {
  id: number;
  eventId: number;
  eventTitle: I18nText;
  name: I18nText;
  family: 'EVENT' | 'COURSE';
  kind: 'REGULAR' | 'OPEN_DAY';
  isImplicit: boolean;
  room: string | null;
  venue: string | null;
  startAt: string;
  endAt: string;
  cancelled: boolean;
  phase: 'UPCOMING' | 'ONGOING' | 'ENDED';
  expected: number;
  /** Nullo per le lezioni: un corso non emette biglietti, e zero sarebbe falso. */
  entries: number | null;
  leaders: number | null;
  followers: number | null;
}

export interface DashboardToday {
  day: string;
  generatedAt: string;
  sessions: TodaySession[];
  appointments: { id: number; title: string; startAt: string; endAt: string; allDay: boolean; room: string | null }[];
  inRoom: number;
  expectedToday: number;
  entriesByQuarter: number[];
  registrations: {
    today: number;
    byFamily: { EVENT: number; COURSE: number };
    byChannel: Record<string, number>;
    lastDays: number[];
  };
  money: {
    total: number;
    online: number;
    boxOffice: number;
    externalShops: number;
    cumulativeByHour: number[];
    openBalances: { count: number; amount: number };
  };
  todo: {
    quarantinedSales: number;
    requirementsUnderReview: number;
    checkInConflicts: number;
    settlementConflicts: number;
  };
  nextEvent: { id: number; title: I18nText; startAt: string; endAt: string; dashboard: EventDashboard } | null;
}

export type ActivityKind = 'CHECK_IN' | 'REGISTRATION' | 'PAYMENT' | 'CALENDAR' | 'PROSPECT';

export interface ActivityRow {
  id: number;
  organizationId: number;
  kind: ActivityKind;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  text: string;
  actorName: string | null;
  staff: boolean;
  amount: number | null;
  eventId: number | null;
  createdAt: string;
}
