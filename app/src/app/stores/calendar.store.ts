import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../core/api/api.client';
import { LocaleService } from '../core/i18n/i18n-text';
import {
  CalendarAppointmentRow,
  CalendarEventRow,
  CalendarItem,
  CalendarSessionRow,
  appointmentToItem,
  eventToItem,
  sessionToItem,
} from '../core/domain/calendar';

interface Rows {
  sessions: CalendarSessionRow[];
  events: CalendarEventRow[];
  appointments: CalendarAppointmentRow[];
}

const EMPTY: Rows = { sessions: [], events: [], appointments: [] };

/**
 * Il periodo visibile del calendario (`20-calendario.md` §6).
 *
 * **Tre letture e non una**, in parallelo: ogni rotta dichiara il proprio
 * permesso, e il permesso decide lo scope. Se una delle tre fallisce le altre
 * restano sulla griglia, e la pagina dice che cosa manca — un calendario senza
 * appuntamenti che non lo dice sembra un calendario senza appuntamenti.
 */
@Injectable({ providedIn: 'root' })
export class CalendarStore {
  private readonly api = inject(ApiClient);
  private readonly locale = inject(LocaleService);

  private readonly rows = signal<Rows>(EMPTY);
  private readonly _loading = signal(false);
  private readonly _missing = signal<string[]>([]);
  private readonly _range = signal<{ from: Date; to: Date } | null>(null);
  /** Una lettura più vecchia che arriva dopo una più nuova non deve sovrascriverla. */
  private sequence = 0;

  readonly loading = this._loading.asReadonly();
  /** Le sorgenti che non si sono potute leggere, per nome. */
  readonly missing = this._missing.asReadonly();
  readonly range = this._range.asReadonly();

  readonly items = computed<CalendarItem[]>(() => {
    const lang = this.locale.lang();
    const { sessions, events, appointments } = this.rows();
    return [
      ...events.map((row) => eventToItem(row, lang)).filter((item): item is CalendarItem => !!item),
      ...sessions.map((row) => sessionToItem(row, lang)),
      ...appointments.map(appointmentToItem),
    ];
  });

  async load(from: Date, to: Date): Promise<void> {
    const ticket = ++this.sequence;
    this._range.set({ from, to });
    this._loading.set(true);
    const body = { from: from.toISOString(), to: to.toISOString() };

    const [sessions, events, appointments] = await Promise.allSettled([
      this.api.post<CalendarSessionRow[]>('/sessions/calendar', body),
      this.api.post<CalendarEventRow[]>('/events/calendar', body),
      this.api.post<CalendarAppointmentRow[]>('/appointments/calendar', body),
    ]);
    if (ticket !== this.sequence) return;

    const value = <T>(result: PromiseSettledResult<T[]>): T[] =>
      result.status === 'fulfilled' ? result.value : [];
    this.rows.set({ sessions: value(sessions), events: value(events), appointments: value(appointments) });
    this._missing.set(
      [
        [sessions, 'lezioni e sessioni'],
        [events, 'eventi'],
        [appointments, 'appuntamenti'],
      ]
        .filter(([result]) => (result as PromiseSettledResult<unknown>).status === 'rejected')
        .map(([, label]) => label as string),
    );
    this._loading.set(false);
  }

  /** Rilegge lo stesso periodo — il segnale `calendar/changed` passa di qui. */
  reload(): Promise<void> {
    const range = this._range();
    return range ? this.load(range.from, range.to) : Promise.resolve();
  }

  /** True quando `[from, to]` tocca il periodo visibile. */
  overlapsRange(from: Date, to: Date): boolean {
    const range = this._range();
    return !!range && from.getTime() < range.to.getTime() && to.getTime() > range.from.getTime();
  }
}
