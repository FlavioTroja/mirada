import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { ArtistKind } from '../core/domain/enums';
import { Artist } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface ArtistQuery extends BaseQuery {
  organizationId?: number;
  kind?: ArtistKind[];
}

/**
 * Store dell'entità `Artist` — anagrafica di «Cast» (§1).
 * Gli artisti **non hanno account** (`RF-EVT-6`): sono anagrafica riutilizzabile.
 */
@Injectable({ providedIn: 'root' })
export class ArtistStore extends EntityStore<Artist, ArtistQuery> {
  protected override readonly base = 'artists';
  /** La fotografia è un riferimento a `File`: si popola per poterla mostrare. */
  protected override readonly listPopulate = 'photoFile';
  protected override readonly detailPopulate = 'photoFile';
  protected override readonly defaultSort = { name: 'asc' as const };
}
