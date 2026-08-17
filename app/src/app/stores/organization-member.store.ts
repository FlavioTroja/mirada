import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { OrgMemberRole } from '../core/auth/roles';
import { OrganizationMember } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface OrganizationMemberQuery extends BaseQuery {
  organizationId?: number;
  userId?: number;
  role?: OrgMemberRole[];
  accepted?: boolean;
}

/**
 * Store dell'entità `OrganizationMember`.
 *
 * I ruoli sono assegnati **per organizzazione, mai per singolo evento**
 * (decisione D-F) e non esiste un preset «Staff» cumulativo (D-G): il titolare
 * li assegna uno per uno.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationMemberStore extends EntityStore<
  OrganizationMember,
  OrganizationMemberQuery
> {
  protected override readonly base = 'organization-members';
  protected override readonly listPopulate = 'user';
  protected override readonly detailPopulate = 'user organization';
  /** Si legge intero — chi ha accesso all'organizzazione va visto tutto: un membro fuori pagina è un permesso di cui nessuno risponde. */
  protected override readonly readsWhole = true;
}
