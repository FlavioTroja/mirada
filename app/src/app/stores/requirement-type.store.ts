import { Injectable, computed } from '@angular/core';
import { RequirementKind } from '../core/domain/enums';
import { RequirementType } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface RequirementTypeQuery {
  active?: boolean;
  kind?: RequirementKind;
}

/** Store dell'entità `RequirementType` — catalogo estensibile, solo `GOD`. */
@Injectable({ providedIn: 'root' })
export class RequirementTypeStore extends EntityStore<RequirementType, RequirementTypeQuery> {
  protected override readonly base = 'requirement-types';
  protected override readonly defaultSort = { id: 'asc' as const };
  /** Si legge intero — il catalogo dei requisiti è la tendina che tutti gli organizzatori vedranno. */
  protected override readonly readsWhole = true;

  readonly active = computed(() => this.items().filter((t) => t.active));
}
