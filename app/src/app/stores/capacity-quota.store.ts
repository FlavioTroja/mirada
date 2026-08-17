import { Injectable, computed } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { DanceRole, QuotaReservedFor, QuotaScope } from '../core/domain/enums';
import { CapacityQuota } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface CapacityQuotaQuery extends BaseQuery {
  eventId?: number;
  scope?: QuotaScope;
  scopeId?: number;
  role?: DanceRole;
  reservedFor?: QuotaReservedFor;
  limiting?: boolean;
}

/**
 * Store dell'entità `CapacityQuota` — «Quota di capienza» (§1).
 *
 * `consumed` è **calcolato dal server**: non viene mai inviato.
 * Sulla quota di capienza della sala (`scope=EVENT`, `role=null`) e sulle quote
 * di ruolo di ambito `EVENT`, `overbookAllowance` è forzato a 0 e `limiting` a
 * `true`: è un vincolo di sicurezza, non una scelta commerciale (§3.6).
 */
@Injectable({ providedIn: 'root' })
export class CapacityQuotaStore extends EntityStore<CapacityQuota, CapacityQuotaQuery> {
  protected override readonly base = 'capacity-quotas';
  protected override readonly defaultSort = { id: 'asc' as const };
  /** Si legge intero — le quote si leggono tutte: una quota fuori pagina è un limite che nessuno sa di avere. */
  protected override readonly readsWhole = true;

  /** La capienza della sala: ambito evento, nessun ruolo, nessuna riserva. */
  readonly venueQuota = computed(
    () =>
      this.items().find(
        (q) => q.scope === 'EVENT' && !q.role && !q.reservedFor,
      ) ?? null,
  );

  readonly eventRoleQuotas = computed(() =>
    this.items().filter((q) => q.scope === 'EVENT' && !!q.role && !q.reservedFor),
  );

  readonly leaderQuota = computed(
    () => this.eventRoleQuotas().find((q) => q.role === 'LEADER') ?? null,
  );
  readonly followerQuota = computed(
    () => this.eventRoleQuotas().find((q) => q.role === 'FOLLOWER') ?? null,
  );

  /**
   * Sbilancio corrente fra i ruoli, con la tolleranza configurata a fianco.
   * Il ruolo in eccesso è **«in attesa»**, mai «esaurito»: sono due stati
   * opposti (`RF-PAY-17`).
   */
  readonly roleBalance = computed(() => {
    const leader = this.leaderQuota();
    const follower = this.followerQuota();
    if (!leader || !follower) return null;
    return {
      leaders: leader.consumed,
      followers: follower.consumed,
      tolerance: leader.imbalanceTolerance ?? follower.imbalanceTolerance ?? null,
      delta: leader.consumed - follower.consumed,
    };
  });

  /**
   * `true` quando i campi `overbookAllowance` e `limiting` vanno **mostrati e
   * disabilitati** con la spiegazione del vincolo di sicurezza (§4.2).
   */
  static isSafetyLocked(quota: Pick<CapacityQuota, 'scope' | 'reservedFor'>): boolean {
    return quota.scope === 'EVENT' && !quota.reservedFor;
  }

  /** Residuo utile: quanto resta prima del limite (lo sforamento non è residuo). */
  static remaining(quota: CapacityQuota): number {
    return Math.max(0, quota.limit - quota.consumed);
  }
}
