import { Injectable, computed, signal } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { OrganizationStatus, PayoutStatus } from '../core/domain/enums';
import { Organization, PayoutStatusReport } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface OrganizationQuery extends BaseQuery {
  status?: OrganizationStatus[];
  payoutStatus?: PayoutStatus[];
}

/**
 * Store dell'entità `Organization`.
 *
 * `stripeAccountId`, `payoutStatus` e `payoutCheckedAt` sono **calcolati dal
 * server** a partire dal prestatore di pagamento: l'interfaccia li mostra, non
 * li invia mai.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationStore extends EntityStore<Organization, OrganizationQuery> {
  protected override readonly base = 'organizations';
  protected override readonly listPopulate = 'address';
  /** Sede e logo sono riferimenti ad altre entità: si popolano per mostrarli. */
  protected override readonly detailPopulate = 'address logoFile';
  protected override readonly defaultSort = { name: 'asc' as const };

  private readonly _payout = signal<PayoutStatusReport | null>(null);
  private readonly _payoutLoading = signal(false);

  readonly payout = this._payout.asReadonly();
  readonly payoutLoading = this._payoutLoading.asReadonly();

  /**
   * La pubblicazione richiede organizzazione `APPROVED` **e** incasso `ENABLED`
   * (`RB13`): il messaggio deve dire **quale dei due manca**.
   */
  readonly publishBlockers = computed<string[]>(() => {
    const org = this.current();
    if (!org) return [];
    const blockers: string[] = [];
    if (org.status !== 'APPROVED') {
      blockers.push('L’organizzazione non è ancora approvata dalla piattaforma.');
    }
    if (org.payoutStatus !== 'ENABLED') {
      blockers.push('L’organizzazione non è abilitata all’incasso presso il prestatore di pagamento.');
    }
    return blockers;
  });

  readonly canPublishEvents = computed(() => this.publishBlockers().length === 0);

  /** `GET /organizations/:id/payout-status` — cruscotto dell'incasso (`RF-ORG-12`). */
  async loadPayoutStatus(id: number): Promise<PayoutStatusReport> {
    this._payoutLoading.set(true);
    try {
      const report = await this.api.fetch<PayoutStatusReport>(`/organizations/${id}/payout-status`);
      this._payout.set(report);
      return report;
    } finally {
      this._payoutLoading.set(false);
    }
  }
}
