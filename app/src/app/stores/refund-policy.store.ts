import { Injectable, computed } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { RefundPolicy, RefundPolicyTier } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface RefundPolicyQuery extends BaseQuery {
  organizationId?: number;
  isPlatformPreset?: boolean;
}

/**
 * Store dell'entità `RefundPolicy` — preset di piattaforma più varianti per
 * organizzazione.
 *
 * Una policy **derivata** da un preset può essere resa **più favorevole al
 * partecipante, mai più restrittiva** (§4.9): `derivedFromPolicyId` è ciò che
 * rende la regola verificabile — senza il riferimento il confronto non ha un
 * termine.
 */
@Injectable({ providedIn: 'root' })
export class RefundPolicyStore extends EntityStore<RefundPolicy, RefundPolicyQuery> {
  protected override readonly base = 'refund-policies';
  protected override readonly listPopulate = 'derivedFromPolicy';
  protected override readonly detailPopulate = 'derivedFromPolicy';
  protected override readonly defaultSort = { id: 'asc' as const };
  /** Si legge intero — le politiche di rimborso si confrontano fra loro, quindi si guardano insieme. */
  protected override readonly readsWhole = true;

  readonly presets = computed(() => this.items().filter((p) => p.isPlatformPreset));

  /**
   * Confronta gli scaglioni della policy con quelli del preset da cui discende.
   * Restituisce le violazioni: uno scaglione più restrittivo del preset.
   */
  static compareWithPreset(
    tiers: RefundPolicyTier[],
    preset: RefundPolicyTier[] | null | undefined,
  ): string[] {
    if (!preset?.length) return [];
    const violations: string[] = [];
    for (const tier of tiers) {
      // Lo scaglione del preset applicabile è quello con `daysBefore` più vicino
      // per difetto: è quello che il partecipante otterrebbe con il preset.
      const applicable = preset
        .filter((p) => p.daysBefore <= tier.daysBefore)
        .sort((a, b) => b.daysBefore - a.daysBefore)[0];
      if (applicable && tier.percent < applicable.percent) {
        violations.push(
          `A ${tier.daysBefore} giorni il preset restituisce il ${applicable.percent}%: ` +
            `il ${tier.percent}% è più restrittivo e non è ammesso.`,
        );
      }
    }
    return violations;
  }
}
