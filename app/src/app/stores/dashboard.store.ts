import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../core/api/api.client';
import { EventDashboard, Section, UnavailableSection } from '../core/domain/dashboard';

/**
 * Store del cruscotto — `GET /events/:id/dashboard` (§3.7, §4.1).
 *
 * Il cruscotto **non è un'entità**: non ha base REST, non ha paginazione, non
 * estende `EntityStore`. Resta uno store a signals come tutto il resto.
 *
 * **`RB21`**: le sezioni con `available: false` non vengono scartate qui né
 * appiattite a zero. Arrivano intere alla pagina, con `requires` e `reason`,
 * perché è la pagina a doverle presentare come *non ancora calcolabili*.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly api = inject(ApiClient);

  private readonly _data = signal<EventDashboard | null>(null);
  private readonly _loading = signal(false);
  private readonly _eventId = signal<number | null>(null);
  private readonly _lastRefreshAt = signal<Date | null>(null);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly eventId = this._eventId.asReadonly();
  readonly lastRefreshAt = this._lastRefreshAt.asReadonly();

  readonly perimeter = computed(() => this._data()?.perimeter ?? null);

  /** Le sezioni dichiarate non calcolabili, con il motivo del backend. */
  readonly unavailable = computed<{ key: string; section: UnavailableSection }[]>(() => {
    const sections = this._data()?.sections ?? {};
    const out: { key: string; section: UnavailableSection }[] = [];
    for (const [key, section] of Object.entries(sections)) {
      if (section && section.available === false) out.push({ key, section });
    }
    return out;
  });

  /**
   * Legge una sezione con la sua forma. Il cast è deliberato: il contratto
   * indicizza le sezioni per nome e ogni nome ha la propria forma, dichiarata
   * in `core/domain/dashboard.ts`.
   */
  section<T>(key: string): Section<T> | null {
    const section = this._data()?.sections?.[key];
    return section ? (section as unknown as Section<T>) : null;
  }

  /** `GET /events/:id/dashboard`. */
  async load(eventId: number): Promise<EventDashboard> {
    this._loading.set(true);
    this._eventId.set(eventId);
    try {
      const data = await this.api.fetch<EventDashboard>(`/events/${eventId}/dashboard`);
      this._data.set(data);
      this._lastRefreshAt.set(new Date());
      return data;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Rifà la GET sull'evento corrente. È ciò che si esegue alla ricezione di un
   * frame WebSocket: **il payload non entra mai nello store** (§3.9, §5).
   */
  async refresh(): Promise<void> {
    const id = this._eventId();
    if (id === null) return;
    await this.load(id);
  }

  clear(): void {
    this._data.set(null);
    this._eventId.set(null);
    this._lastRefreshAt.set(null);
  }
}
