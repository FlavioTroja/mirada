import { Injectable, NgZone, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiClient } from '../core/api/api.client';
import { ApiError } from '../core/api/api-error';
import { PaginateDatasource, emptyPage } from '../core/api/paginate';
import {
  EventAvailability,
  PublicEvent,
  PublicEventCard,
  PublicEventQuery,
  TicketTypeAvailability,
} from '../core/domain/models';

/**
 * Store dell'entità `Event` sul lato pubblico (§5: **uno store per entità**,
 * signals, nessuno store «di pagina»).
 *
 * Copre le tre chiamate pubbliche del §3.7:
 *
 *  - `POST /api/public/events/`               ricerca paginata, senza autenticazione
 *  - `GET  /api/public/events/:slug`          scheda completa
 *  - `POST /api/public/events/:id/availability` numeri vivi, **polling 10–15 s**
 *
 * Il polling esiste perché il canale WebSocket richiede il `wsCode` del profilo
 * e **il visitatore anonimo non ne ha** (§3.9, decisione D-H).
 */
const POLL_MS = 12_000;

@Injectable({ providedIn: 'root' })
export class EventStore {
  private readonly api = inject(ApiClient);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ── Ricerca ──────────────────────────────────────────────────────────────
  private readonly _page = signal<PaginateDatasource<PublicEventCard>>(emptyPage<PublicEventCard>());
  private readonly _query = signal<PublicEventQuery>({});
  private readonly _searching = signal(false);
  private readonly _searchError = signal<string | null>(null);

  readonly results = computed(() => this._page().docs);
  readonly pagination = this._page.asReadonly();
  readonly query = this._query.asReadonly();
  readonly searching = this._searching.asReadonly();
  readonly searchError = this._searchError.asReadonly();
  readonly total = computed(() => this._page().totalDocs);

  // ── Scheda ───────────────────────────────────────────────────────────────
  private readonly _current = signal<PublicEvent | null>(null);
  private readonly _loading = signal(false);
  private readonly _notFound = signal(false);

  readonly current = this._current.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly notFound = this._notFound.asReadonly();

  // ── Disponibilità viva ───────────────────────────────────────────────────
  private readonly _availability = signal<EventAvailability | null>(null);
  readonly availability = this._availability.asReadonly();
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Disponibilità del singolo titolo d'ingresso, per `id`. */
  readonly availabilityByTicketType = computed<Map<number, TicketTypeAvailability>>(() => {
    const map = new Map<number, TicketTypeAvailability>();
    for (const tt of this._availability()?.ticketTypes ?? []) map.set(tt.id, tt);
    return map;
  });

  /** `POST /api/public/events/` — solo eventi `PUBLISHED` con vendita aperta. */
  async search(query: PublicEventQuery, page = 1, limit = 12): Promise<void> {
    this._searching.set(true);
    this._searchError.set(null);
    this._query.set(query);
    try {
      const res = await this.api.list<PublicEventCard, PublicEventQuery>('public/events', query, {
        page,
        limit,
      });
      this._page.set(res);
    } catch (err) {
      this._searchError.set(
        err instanceof ApiError ? err.message : 'Ricerca non riuscita. Riprova.',
      );
      this._page.set(emptyPage<PublicEventCard>(limit));
    } finally {
      this._searching.set(false);
    }
  }

  /** `GET /api/public/events/:slug` — scheda completa. */
  async loadBySlug(slug: string): Promise<PublicEvent | null> {
    if (this._current()?.slug === slug && !this._notFound()) return this._current();
    this._loading.set(true);
    this._notFound.set(false);
    try {
      const event = await this.api.fetch<PublicEvent>(`/public/events/${slug}`);
      this._current.set(event);
      return event;
    } catch (err) {
      this._current.set(null);
      this._notFound.set(err instanceof ApiError && err.kind === 'not-found');
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  /** `POST /api/public/events/:id/availability` — una lettura sola. */
  async loadAvailability(eventId: number): Promise<void> {
    try {
      this._availability.set(
        await this.api.post<EventAvailability>(`/public/events/${eventId}/availability`, {}),
      );
    } catch {
      // La disponibilità è un di più sopra a una scheda già resa: se non
      // arriva, la pagina resta leggibile con i prezzi di listino.
    }
  }

  /**
   * Avvia il polling a 12 s. **Solo nel browser**: sul server non esiste un
   * ciclo di vita in cui rieseguire, e un `setInterval` bloccherebbe la resa.
   *
   * Il timer vive **fuori dalla zona Angular**. Un `setInterval` ricorrente
   * dentro la zona tiene l'applicazione perennemente «instabile»: l'idratazione
   * aspetta la stabilità e non arriva mai (`NG0506`), osservato in console alla
   * prima stesura. Il ricarico rientra nella zona solo per aggiornare lo store.
   */
  startPolling(eventId: number): void {
    if (!this.isBrowser) return;
    this.stopPolling();
    void this.loadAvailability(eventId);
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        this.zone.run(() => void this.loadAvailability(eventId));
      }, POLL_MS);
    });
  }

  stopPolling(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  clearCurrent(): void {
    this._current.set(null);
    this._availability.set(null);
    this._notFound.set(false);
  }
}
