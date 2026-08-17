import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { FiscalDeclarationKind } from '../core/domain/enums';
import { FiscalDeclaration } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface FiscalDeclarationQuery extends BaseQuery {
  organizationId?: number;
  eventId?: number;
  kind?: FiscalDeclarationKind;
}

/**
 * Store dell'entità `FiscalDeclaration` — «Dichiarazione di inquadramento».
 *
 * È **immutabile** (`RF-ORG-8`): si crea una nuova versione, non si aggiorna.
 * Lo store non espone quindi `update` come operazione di dominio, e le pagine
 * non offrono la modifica.
 */
@Injectable({ providedIn: 'root' })
export class FiscalDeclarationStore extends EntityStore<FiscalDeclaration, FiscalDeclarationQuery> {
  protected override readonly base = 'fiscal-declarations';
  protected override readonly listPopulate = 'declaredBy event';
  protected override readonly detailPopulate = 'declaredBy event organization';
  protected override readonly defaultSort = { id: 'desc' as const };
  /** Si legge intero — le dichiarazioni si leggono per intero: una mancante è un adempimento che sembra fatto. */
  protected override readonly readsWhole = true;
}
