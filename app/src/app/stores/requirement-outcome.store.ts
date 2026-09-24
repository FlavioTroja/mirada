import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { RequirementOutcomeStatus } from '../core/domain/enums';
import { RequirementOutcome } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface RequirementOutcomeQuery extends BaseQuery {
  registrationId?: number;
  eventRequirementId?: number;
  eventId?: number;
  status?: RequirementOutcomeStatus;
}

/**
 * Store dell'entità `RequirementOutcome` — l'esito di ogni requisito
 * dell'evento per un'iscrizione (§4.10).
 *
 * La revisione passa dal `PATCH` normale con `status` ed eventuale
 * `rejectionReason`: **chi ha deciso e quando** li timbra il server
 * (`reviewedByUserId`, `reviewedAt`), e il client non li manda.
 */
@Injectable({ providedIn: 'root' })
export class RequirementOutcomeStore extends EntityStore<RequirementOutcome, RequirementOutcomeQuery> {
  protected override readonly base = 'requirement-outcomes';
  protected override readonly listPopulate = 'eventRequirement';
  protected override readonly defaultSort = { id: 'asc' as const };

  ofRegistration(registrationId: number): Promise<RequirementOutcome[]> {
    return this.loadAll({ registrationId });
  }

  approve(id: number): Promise<RequirementOutcome> {
    return this.update(id, { status: 'VALID', rejectionReason: null });
  }

  /** Un rifiuto senza motivo è un rifiuto che nessuno sa correggere: il motivo è obbligatorio. */
  reject(id: number, rejectionReason: string): Promise<RequirementOutcome> {
    return this.update(id, { status: 'REJECTED', rejectionReason });
  }
}
