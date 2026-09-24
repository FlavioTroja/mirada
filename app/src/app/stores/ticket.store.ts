import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { TicketStatus } from '../core/domain/enums';
import { Ticket } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface TicketQuery extends BaseQuery {
  eventId?: number;
  ticketTypeId?: number;
  registrationId?: number;
  passIssuanceId?: number;
  status?: TicketStatus;
  bearer?: boolean;
}

/** Store dell'entità `Ticket` — i biglietti emessi (§4.12). */
@Injectable({ providedIn: 'root' })
export class TicketStore extends EntityStore<Ticket, TicketQuery> {
  protected override readonly base = 'tickets';
  protected override readonly listPopulate = 'ticketType';
  protected override readonly defaultSort = { qrIssuedAt: 'desc' as const };

  /** I biglietti di una persona in un evento: di solito uno, più d'uno dopo un trasferimento. */
  ofRegistration(registrationId: number): Promise<Ticket[]> {
    return this.loadAll({ registrationId });
  }
}
