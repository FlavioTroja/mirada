import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { ArtistKind } from '../core/domain/enums';
import { EventCast } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface EventCastQuery extends BaseQuery {
  eventId?: number;
  artistId?: number;
  kind?: ArtistKind;
}

/** Store dell'entità `EventCast` — il «Cast» dell'evento: maestri, DJ, orchestre (§1). */
@Injectable({ providedIn: 'root' })
export class EventCastStore extends EntityStore<EventCast, EventCastQuery> {
  protected override readonly base = 'event-casts';
  protected override readonly listPopulate = 'artist';
  protected override readonly detailPopulate = 'artist';
  protected override readonly defaultSort = { sortOrder: 'asc' as const };
}
