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

  /**
   * `POST …/plan/generate` — **«tre rate mensili da ottobre»** (`18-rate.md`).
   *
   * Gli importi li ripartisce il **server**: 100 € in tre rate sono
   * 33,34 · 33,33 · 33,33, e la somma torna al centesimo. Dividere qui
   * significherebbe rischiare un arrotondamento diverso dal suo, e un piano
   * rifiutato per una cifra che l'operatore non ha scelto.
   */
  generatePlan(registrationId: number, count: number, firstDueAt: string): Promise<RegistrationBalance> {
    return this.api.post<RegistrationBalance>(
      `/balance-settlements/registration/${registrationId}/plan/generate`,
      { count, firstDueAt },
    );
  }

  /** `PATCH …/plan` con l'array intero. Vuoto = il piano si cancella. */
  replacePlan(
    registrationId: number,
    instalments: { amount: number; dueAt: string; note?: string }[],
  ): Promise<RegistrationBalance> {
    return this.api.patchPath<RegistrationBalance>(
      `/balance-settlements/registration/${registrationId}/plan`,
      { instalments },
    );
  }
}
