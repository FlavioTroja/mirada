import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import {
  SalesChannel,
  SalesChannelDepositCode,
  SalesChannelMapping,
  SalesChannelStatus,
} from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface SalesChannelQuery extends BaseQuery {
  organizationId?: number;
  status?: SalesChannelStatus;
}

/**
 * Store dell'entità `SalesChannel` — i negozi esterni collegati (fase E) e i
 * loro **codici di acconto** (`14` §3.1).
 *
 * ── I due figli si scrivono con un solo `PUT` che porta l'array intero ───────
 * Mappature e codici sono collezioni possedute dal canale: `id: -1` = riga
 * nuova, `toBeDisconnected: true` = riga rimossa. Il verbo è `PUT`, non `PATCH`
 * come sui figli del titolo d'ingresso — è ciò che dichiarano quelle rotte.
 *
 * ⚠️ **I segreti non tornano indietro.** `webhookSecret` e `credentials` sono
 * cifrati in colonna e nessuna lettura li restituisce: si mandano alla
 * creazione, e si rimandano soltanto quando si vogliono davvero sostituire.
 */
@Injectable({ providedIn: 'root' })
export class SalesChannelStore extends EntityStore<SalesChannel, SalesChannelQuery> {
  protected override readonly base = 'sales-channels';
  protected override readonly listPopulate = 'mappings depositCodes';
  protected override readonly detailPopulate = 'mappings depositCodes';
  protected override readonly defaultSort = { id: 'asc' as const };
  /** Si legge intero: i negozi collegati sono pochi e si guardano insieme. */
  protected override readonly readsWhole = true;

  /** `PUT /sales-channels/:id/mappings` — la traduzione prodotto → titolo. */
  async saveMappings(id: number, rows: Partial<SalesChannelMapping>[]): Promise<void> {
    await this.api.putChildren(this.base, id, 'mappings', rows);
  }

  /**
   * `PUT /sales-channels/:id/deposit-codes` — quali codici sconto significano
   * «acconto».
   *
   * Toglierne uno **non riscrive il passato**: i residui già nati restano sulle
   * iscrizioni, perché sono debiti di persone reali e non una vista sulla
   * configurazione.
   */
  async saveDepositCodes(id: number, rows: Partial<SalesChannelDepositCode>[]): Promise<void> {
    await this.api.putChildren(this.base, id, 'deposit-codes', rows);
  }
}
