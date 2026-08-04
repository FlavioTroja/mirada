import { Injectable, computed } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { EventType } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface EventTypeQuery extends BaseQuery {
  active?: boolean;
  slug?: string;
}

/**
 * Store dell'entità `EventType` — catalogo estensibile a runtime, solo `GOD`.
 *
 * Le **cinque capacità** (`capMultiSession`, `capRoleQuotas`, `capLevels`,
 * `capCast`, `capCouple`) **generano il wizard** di creazione evento: creare o
 * modificare un tipo evento significa cambiare l'interfaccia che gli
 * organizzatori incontrano (§4.10).
 */
@Injectable({ providedIn: 'root' })
export class EventTypeStore extends EntityStore<EventType, EventTypeQuery> {
  protected override readonly base = 'event-types';
  protected override readonly defaultSort = { sortOrder: 'asc' as const };

  readonly active = computed(() => this.items().filter((t) => t.active));

  /** Sezioni del workspace evento attivate dalle cinque capacità. */
  static sectionsOf(type: Pick<EventType, 'capMultiSession' | 'capRoleQuotas' | 'capLevels' | 'capCast' | 'capCouple'>): string[] {
    const sections = ['Dati base', 'Titoli d’ingresso', 'Requisiti', 'Servizi', 'Quote di capienza'];
    if (type.capMultiSession) sections.splice(1, 0, 'Sessioni');
    if (type.capCast) sections.push('Cast');
    if (type.capRoleQuotas) sections.push('Quote per ruolo');
    if (type.capLevels) sections.push('Livelli');
    if (type.capCouple) sections.push('Iscrizione a coppia');
    return sections;
  }
}
