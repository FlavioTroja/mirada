import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { Couple } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface CoupleQuery extends BaseQuery {
  eventId?: number;
  dissolved?: boolean;
}

/**
 * Store dell'entità `Couple` — «Coppia» (§1).
 *
 * La coppia **non porta riferimenti alle due iscrizioni**: sono le
 * `Registration` a puntare alla coppia con `coupleId` (§3.6).
 * Sciogliere una coppia non muove alcun consumo: le persone restano.
 */
@Injectable({ providedIn: 'root' })
export class CoupleStore extends EntityStore<Couple, CoupleQuery> {
  protected override readonly base = 'couples';
  protected override readonly listPopulate = 'registrations';
  protected override readonly detailPopulate = 'registrations';

  /**
   * `POST /couples/:id/dissolve` (§3.7) — scioglie il legame, non l'iscrizione.
   * **Non muove alcun consumo**: le persone restano, cambia solo il legame
   * (`RF-CPL-9`).
   */
  dissolve(id: number): Promise<Couple> {
    return this.runAction(id, 'dissolve');
  }
}
