import { Injectable, computed } from '@angular/core';
import { ServiceType } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface ServiceTypeQuery {
  active?: boolean;
}

/** Store dell'entità `ServiceType` — catalogo estensibile, solo `GOD`. */
@Injectable({ providedIn: 'root' })
export class ServiceTypeStore extends EntityStore<ServiceType, ServiceTypeQuery> {
  protected override readonly base = 'service-types';
  protected override readonly defaultSort = { id: 'asc' as const };

  readonly active = computed(() => this.items().filter((t) => t.active));
}
