import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { CheckInKind } from '../core/domain/enums';
import { CheckIn } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface CheckInQuery extends BaseQuery {
  eventId?: number;
  sessionId?: number;
  ticketId?: number;
  registrationId?: number;
  kind?: CheckInKind;
  offline?: boolean;
  conflictsOnly?: boolean;
  includeRevoked?: boolean;
}

/**
 * Store dell'entità `CheckIn` — gli ingressi registrati alla porta (§4.13).
 *
 * ⚠️ **Nessun `populate=operator`.** La relazione esiste, ma porterebbe al
 * browser la riga intera dell'utenza di un volontario per stamparne il nome:
 * la postazione (`deviceId`) è ciò che la porta usa per dire chi ha scansionato.
 */
@Injectable({ providedIn: 'root' })
export class CheckInStore extends EntityStore<CheckIn, CheckInQuery> {
  protected override readonly base = 'check-ins';
  protected override readonly listPopulate = 'session';
  protected override readonly defaultSort = { scannedAt: 'asc' as const };

  /**
   * Gli ingressi di un'iscrizione, **annullati compresi**: un ingresso annullato
   * è un fatto corretto, non un fatto sparito, e chi ricostruisce una serata
   * deve poterlo leggere.
   */
  ofRegistration(registrationId: number): Promise<CheckIn[]> {
    return this.loadAll({ registrationId, includeRevoked: true });
  }
}
