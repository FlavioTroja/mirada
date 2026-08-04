import { Injectable, computed } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { DanceRole, RegistrationChannel, RegistrationStatus } from '../core/domain/enums';
import { Registration } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface RegistrationQuery extends BaseQuery {
  eventId?: number;
  assignedRole?: DanceRole;
  status?: RegistrationStatus;
  channel?: RegistrationChannel;
  coupleId?: number;
}

/**
 * Store dell'entità `Registration` — **«Iscrizione»**: la *persona* nell'evento,
 * non il titolo economico (§1).
 *
 * `assignedRole` è **calcolato dal server**: la riassegnazione non passa da un
 * `PATCH`, ma dall'azione dedicata, con le **stesse verifiche di un acquisto**
 * (§4.3) — può quindi fallire con `SOLD_OUT` o `ROLE_ON_HOLD`.
 */
@Injectable({ providedIn: 'root' })
export class RegistrationStore extends EntityStore<Registration, RegistrationQuery> {
  protected override readonly base = 'registrations';
  protected override readonly listPopulate = 'couple';
  protected override readonly detailPopulate = 'couple event quotaConsumptions';
  protected override readonly defaultSort = { id: 'desc' as const };

  readonly leaders = computed(() => this.items().filter((r) => r.assignedRole === 'LEADER').length);
  readonly followers = computed(
    () => this.items().filter((r) => r.assignedRole === 'FOLLOWER').length,
  );
  /** Iscrizioni con ruolo dichiarato flessibile ancora da risolvere. */
  readonly pendingFlexible = computed(
    () => this.items().filter((r) => r.declaredRole === 'FLEXIBLE' && !r.assignedRole).length,
  );

  /** `POST /registrations/:id/confirm` (§3.7) — conferma della persona iscritta da altri. */
  confirm(id: number): Promise<Registration> {
    return this.runAction(id, 'confirm');
  }

  /**
   * `POST /registrations/:id/decline` (§3.7) — il rifiuto rende il biglietto
   * **privo di titolare e lo restituisce alla disponibilità dell'acquirente**
   * (`RF-CPL-13`, `RF-CPL-14`, `RB24`).
   */
  decline(id: number, reason?: string): Promise<Registration> {
    return this.runAction(id, 'decline', reason ? { reason } : {});
  }

  /**
   * `POST /registrations/:id/reassign-role` (§3.7) — rilascia i consumi del
   * vecchio ruolo e impegna quelli del nuovo **nella stessa transazione**, con
   * le stesse verifiche di un acquisto. Fallisce con `SOLD_OUT` (definitivo) o
   * `ROLE_ON_HOLD` (temporaneo) se il nuovo ruolo non ha capienza.
   *
   * Esiste perché `assignedRole` è **escluso dal `PATCH`**: non è un campo che
   * il client possa scrivere (`RF-CPL-3`).
   */
  reassignRole(
    id: number,
    role: DanceRole,
    extra: { ticketTypeId?: number | null; serviceIds?: number[] } = {},
  ): Promise<Registration> {
    return this.runAction(id, 'reassign-role', { role, ...extra });
  }
}
