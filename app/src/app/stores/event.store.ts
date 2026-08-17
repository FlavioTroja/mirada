import { Injectable, computed } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { EventStatus } from '../core/domain/enums';
import { MiradaEvent, OrphanSessionResolution } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface EventQuery extends BaseQuery {
  status?: EventStatus[];
  organizationId?: number;
  eventTypeId?: number;
  venueId?: number;
}

/**
 * Store dell'entità `Event` — è anche il **contesto corrente** condiviso da tutte
 * le pagine del workspace `/events/:id/…` (§4.2 `shared_state`).
 *
 * Il ciclo di vita non passa mai da un `PATCH` generico: usa gli endpoint
 * dedicati del §3.7.
 */
@Injectable({ providedIn: 'root' })
export class EventStore extends EntityStore<MiradaEvent, EventQuery> {
  protected override readonly base = 'events';
  /**
   * `posterVerticalFile` serve alla locandina in miniatura dell'elenco: è il
   * ritaglio che il pubblico vede aprendo l'evento, quindi è anche quello che
   * fa riconoscere la riga giusta a colpo d'occhio. Gli altri due ritagli
   * restano fuori: nell'elenco non si vedono, e caricarli sarebbe traffico
   * speso per niente.
   */
  protected override readonly listPopulate = 'eventType venue organization posterVerticalFile';
  /** I tre ritagli della locandina sono riferimenti a `File`: si popolano per mostrarli. */
  protected override readonly detailPopulate =
    'eventType venue organization posterVerticalFile posterHorizontalFile posterSquareFile';
  protected override readonly defaultSort = { startAt: 'desc' as const };

  /** Le cinque capacità del `EventType` **generano** le schede visibili (§4.2). */
  readonly capabilities = computed(() => {
    const type = this.current()?.eventType;
    return {
      multiSession: type?.capMultiSession ?? true,
      roleQuotas: type?.capRoleQuotas ?? true,
      levels: type?.capLevels ?? true,
      cast: type?.capCast ?? true,
      couple: type?.capCouple ?? true,
    };
  });

  readonly isDraft = computed(() => this.current()?.status === 'DRAFT');
  readonly isPublished = computed(() => this.current()?.status === 'PUBLISHED');
  readonly isCancelled = computed(() => this.current()?.status === 'CANCELLED');
  readonly salesClosed = computed(() => this.current()?.status === 'SALES_CLOSED');

  /** `POST /events/:id/publish` — verifica `RB13` prima di pubblicare. */
  publish(id: number): Promise<MiradaEvent> {
    return this.runAction(id, 'publish');
  }

  /** `POST /events/:id/close-sales` (`RF-EVT-40`). */
  closeSales(id: number): Promise<MiradaEvent> {
    return this.runAction(id, 'close-sales');
  }

  /** `POST /events/:id/reopen-sales` (`RF-EVT-40`). */
  reopenSales(id: number): Promise<MiradaEvent> {
    return this.runAction(id, 'reopen-sales');
  }

  /** `POST /events/:id/cancel` — la motivazione è obbligatoria (`RF-EVT-41`). */
  cancel(id: number, reason: string): Promise<MiradaEvent> {
    return this.runAction(id, 'cancel', { reason });
  }

  /** `POST /events/:id/duplicate` — nuova edizione azzerata (`RF-EVT-16`). */
  async duplicate(id: number): Promise<MiradaEvent> {
    const created = await this.api.post<MiradaEvent>(`/events/${id}/duplicate`);
    await this.load();
    return created;
  }

  /**
   * `POST /events/:id/orphan-sessions/resolve` (`RF-EVT-24`): quali titoli non
   * includono la sessione, **distinguendo i venduti dagli invenduti**.
   */
  resolveOrphanSession(eventId: number, sessionId: number): Promise<OrphanSessionResolution> {
    return this.api.post<OrphanSessionResolution>(`/events/${eventId}/orphan-sessions/resolve`, {
      sessionId,
    });
  }
}
