import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { EventService } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface EventServiceQuery extends BaseQuery {
  eventId?: number;
  serviceTypeId?: number;
}

/**
 * Store dell'entità `EventService` — i servizi accessori dell'evento.
 * Il `price` è in **centesimi interi**.
 */
@Injectable({ providedIn: 'root' })
export class EventServiceStore extends EntityStore<EventService, EventServiceQuery> {
  protected override readonly base = 'event-services';
  protected override readonly listPopulate = 'serviceType';
  protected override readonly detailPopulate = 'serviceType';
  protected override readonly defaultSort = { sortOrder: 'asc' as const };
}
