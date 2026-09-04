import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { BalanceSettlement, RegistrationBalance } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface BalanceSettlementQuery extends BaseQuery {
  eventId?: number;
  registrationId?: number;
  operatorUserId?: number;
  conflictsOnly?: boolean;
}

/**
 * Store del registro dei **saldi incassati al botteghino** (`14` §6).
 *
 * ── Due cose che questo store non fa, e non deve ────────────────────────────
 * Non modifica un incasso e non lo cancella: una riga è un fatto — qualcuno ha
 * preso in mano dei soldi — e si corregge con una riga che la contraddice, non
 * facendola sparire. Il backend non espone nemmeno le rotte.
 *
 * Non tiene un contatore suo: `settledAmount` arriva dal server, che lo muove
 * nella stessa transazione della riga. Sommare gli importi qui produrrebbe un
 * secondo totale, e prima o poi i due direbbero cose diverse.
 */
@Injectable({ providedIn: 'root' })
export class BalanceSettlementStore extends EntityStore<BalanceSettlement, BalanceSettlementQuery> {
  protected override readonly base = 'balance-settlements';
  protected override readonly defaultSort = { collectedAt: 'desc' as const };

  /**
   * `GET /balance-settlements/registration/:id` — quanto deve **questa persona**,
   * quanto ha già versato, e ogni incasso con operatore e momento.
   *
   * ⚠️ Porta la **cifra**, quindi la rotta chiede il permesso di cassa: chi non
   * ce l'ha riceve `403`. Non è una schermata da nascondere, è una chiamata da
   * non fare — l'operatore di porta vede che un saldo esiste dalla verifica del
   * biglietto, e l'importo non gli viene spedito (`RB27`).
   */
  balanceOf(registrationId: number): Promise<RegistrationBalance> {
    return this.api.fetch<RegistrationBalance>(`/balance-settlements/registration/${registrationId}`);
  }
}
