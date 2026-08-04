import { Injectable, computed } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { TicketTypeVisibility } from '../core/domain/enums';
import { PricePreview, PriceTier, TicketType, TicketTypeSession } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface TicketTypeQuery extends BaseQuery {
  eventId?: number;
  visibility?: TicketTypeVisibility;
  highlighted?: boolean;
}

/**
 * Store dell'entità `TicketType` — **«Titolo d'ingresso»**, mai «biglietto»:
 * quello è l'esemplare venduto (§1).
 *
 * I due figli posseduti si scrivono con **un solo `PATCH` che porta l'array
 * intero** (§3.2): `id: -1` = riga nuova, `toBeDisconnected: true` = rimossa.
 */
@Injectable({ providedIn: 'root' })
export class TicketTypeStore extends EntityStore<TicketType, TicketTypeQuery> {
  protected override readonly base = 'ticket-types';
  protected override readonly defaultSort = { sortOrder: 'asc' as const };
  protected override readonly detailPopulate = 'sessions priceTiers';

  /**
   * Un titolo `PER_COUPLE` **non è acquistabile da solo**: senza un titolo per
   * persona i ballerini singoli restano fuori (`T5`).
   */
  readonly hasPerPersonTicket = computed(() =>
    this.items().some((t) => t.saleUnit === 'PER_PERSON'),
  );

  readonly coupleOnly = computed(
    () => this.items().length > 0 && !this.hasPerPersonTicket(),
  );

  /** `PATCH /ticket-types/:id/sessions` — elenco esplicito delle sessioni incluse. */
  async saveSessions(id: number, rows: TicketTypeSession[]): Promise<void> {
    await this.api.patchChildren(this.base, id, 'sessions', rows);
  }

  /** `PATCH /ticket-types/:id/price-tiers` — scaglioni di prezzo. */
  async savePriceTiers(id: number, rows: PriceTier[]): Promise<void> {
    await this.api.patchChildren(this.base, id, 'price-tiers', rows);
  }

  /** `POST /ticket-types/:id/price-preview` — scaglione attivo con dati reali (`RF-EVT-26`). */
  pricePreview(id: number, quantity = 1): Promise<PricePreview> {
    return this.api.post<PricePreview>(`/ticket-types/${id}/price-preview`, { quantity });
  }
}
