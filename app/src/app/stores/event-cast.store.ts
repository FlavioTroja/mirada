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
  /**
   * `artist.photoFile` serve al ritratto accanto al nome: la fotografia è un
   * riferimento a `File`, e senza popolarla resterebbe un identificativo.
   */
  protected override readonly listPopulate = 'artist artist.photoFile';
  protected override readonly detailPopulate = 'artist artist.photoFile';
  protected override readonly defaultSort = { sortOrder: 'asc' as const };
  /** Si legge intero — l'ordine di una voce di cast ha senso solo rispetto a tutte le altre. */
  protected override readonly readsWhole = true;
}
