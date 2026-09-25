import { Injectable, inject, signal } from '@angular/core';
import { ApiClient } from '../core/api/api.client';
import { ActivityRow, DashboardToday } from '../core/domain/dashboard-today';
import { fromWallClock, todayKey } from '../core/i18n/zoned';

/**
 * La Dashboard dell'organizzazione (`21-dashboard.md`): la giornata, la
 * colonna «In tempo reale» e il «Registro di oggi». Tre letture separate
 * perché cambiano per ragioni diverse: un ingresso muove la prima, una riga
 * d'attività le altre due.
 */
@Injectable({ providedIn: 'root' })
export class DashboardTodayStore {
  private readonly api = inject(ApiClient);

  private readonly _today = signal<DashboardToday | null>(null);
  private readonly _feed = signal<ActivityRow[]>([]);
  private readonly _log = signal<ActivityRow[]>([]);
  private readonly _error = signal<string | null>(null);
  private readonly _loadedAt = signal<Date | null>(null);

  readonly today = this._today.asReadonly();
  readonly feed = this._feed.asReadonly();
  readonly log = this._log.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loadedAt = this._loadedAt.asReadonly();

  async loadToday(): Promise<void> {
    try {
      this._today.set(await this.api.fetch<DashboardToday>('/dashboard/today'));
      this._loadedAt.set(new Date());
      this._error.set(null);
    } catch {
      this._error.set('Non è stato possibile leggere la giornata. Riprova tra poco.');
    }
  }

  async loadActivity(): Promise<void> {
    const since = fromWallClock(todayKey()).toISOString();
    try {
      const [feed, log] = await Promise.all([
        this.api.fetch<ActivityRow[]>('/dashboard/activity?limit=50'),
        this.api.fetch<ActivityRow[]>(`/dashboard/activity?staffOnly=true&limit=20&since=${encodeURIComponent(since)}`),
      ]);
      this._feed.set(feed);
      this._log.set(log);
    } catch {
      /* il flusso resta com'era: la giornata si legge comunque */
    }
  }
}
