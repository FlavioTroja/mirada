import { Injectable, computed } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { Session } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface SessionQuery extends BaseQuery {
  eventId?: number;
  includeCancelled?: boolean;
}

/** Store dell'entità `Session` — workshop, milonga, spettacolo (§1). */
@Injectable({ providedIn: 'root' })
export class SessionStore extends EntityStore<Session, SessionQuery> {
  protected override readonly base = 'sessions';
  protected override readonly defaultSort = { startAt: 'asc' as const };
  /** Si legge intero — il programma di un evento si legge tutto: una giornata nascosta è una giornata che nessuno pubblica. */
  protected override readonly readsWhole = true;

  readonly active = computed(() => this.items().filter((s) => !s.cancelledAt));
  readonly cancelled = computed(() => this.items().filter((s) => !!s.cancelledAt));

  /** Somma dei pesi di ripartizione delle sessioni attive (`RF-EVT-36`). */
  readonly totalWeight = computed(() =>
    this.active().reduce((sum, s) => sum + (s.allocationWeight ?? 1), 0),
  );

  /**
   * `POST /sessions/:id/cancel` — annullamento di una **singola** sessione su
   * evento che si svolge regolarmente: rilascia le quote della sessione
   * (`RF-EVT-35`). La motivazione è obbligatoria.
   */
  cancelSession(id: number, reason: string): Promise<Session> {
    return this.runAction(id, 'cancel', { reason });
  }
}
