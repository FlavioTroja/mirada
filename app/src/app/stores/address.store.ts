import { Injectable, signal } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { Address } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface AddressQuery extends BaseQuery {
  city?: string;
  province?: string;
  country?: string;
  personId?: number;
}

/**
 * Store dell'entità `Address` — base REST piena `/addresses` (§3.4).
 *
 * **Unica eccezione al soft delete del §3.2**: `Address` è l'unica entità del
 * dialetto priva della colonna `deleted`, perché la foundation non gliela dà e
 * i suoi lettori (`GET /addresses/cities`, il populate `person.addresses`) non
 * filtrerebbero comunque su di essa. `DELETE /addresses/:id` è quindi una
 * **cancellazione reale**, e l'interfaccia deve dirlo invece di far credere a
 * un cestino.
 *
 * Un indirizzo **ancora referenziato** da una `Venue` o da una `Organization`
 * risponde `400`: è un vincolo, non un errore generico.
 */
@Injectable({ providedIn: 'root' })
export class AddressStore extends EntityStore<Address, AddressQuery> {
  protected override readonly base = 'addresses';
  protected override readonly defaultSort = { id: 'desc' as const };

  private readonly _cities = signal<string[]>([]);
  readonly cities = this._cities.asReadonly();

  /** `GET /addresses/cities` — l'unica rotta che il template spediva. */
  async loadCities(): Promise<string[]> {
    const res = await this.api.fetch<{ cities: string[] | null }>('/addresses/cities');
    const cities = res.cities ?? [];
    this._cities.set(cities);
    return cities;
  }
}

/** Riga d'indirizzo leggibile: `Via dei Fori Imperiali 1, 00184 Roma (RM)`. */
export function formatAddress(address: Address | null | undefined): string {
  if (!address) return '';
  const street = [address.address, address.number].filter(Boolean).join(' ').trim();
  const town = [address.zipCode, address.city].filter(Boolean).join(' ').trim();
  const province = address.province ? `(${address.province})` : '';
  const line = [street, [town, province].filter(Boolean).join(' ').trim()]
    .filter(Boolean)
    .join(', ');
  return [line, address.country].filter(Boolean).join(' — ');
}
