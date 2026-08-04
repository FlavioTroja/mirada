import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { Venue } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface VenueQuery extends BaseQuery {
  organizationId?: number;
  accessibleOnly?: boolean;
}

/**
 * Store dell'entità `Venue` — «Location» (§1). Riutilizzabile fra eventi.
 *
 * La `capacity` della location è **proposta come default** alla creazione della
 * quota di capienza della sala, **mai imposta**: assenza di quota significa
 * assenza di vincolo (§4.8).
 */
@Injectable({ providedIn: 'root' })
export class VenueStore extends EntityStore<Venue, VenueQuery> {
  protected override readonly base = 'venues';
  protected override readonly listPopulate = 'address';
  protected override readonly detailPopulate = 'address';
  protected override readonly defaultSort = { name: 'asc' as const };
}
