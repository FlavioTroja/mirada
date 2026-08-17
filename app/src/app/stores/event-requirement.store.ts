import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { RequirementBlocking } from '../core/domain/enums';
import { EventRequirement } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface EventRequirementQuery extends BaseQuery {
  eventId?: number;
  requirementTypeId?: number;
  blocking?: RequirementBlocking;
  mandatory?: boolean;
}

/** Store dell'entità `EventRequirement` — i requisiti di partecipazione dell'evento. */
@Injectable({ providedIn: 'root' })
export class EventRequirementStore extends EntityStore<EventRequirement, EventRequirementQuery> {
  protected override readonly base = 'event-requirements';
  protected override readonly listPopulate = 'requirementType';
  protected override readonly detailPopulate = 'requirementType';
  protected override readonly defaultSort = { sortOrder: 'asc' as const };
  /** Si legge intero — i requisiti di un evento si leggono tutti: quello nascosto è quello che nessuno soddisfa. */
  protected override readonly readsWhole = true;
}
