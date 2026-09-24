import { Injectable } from '@angular/core';
import { BaseQuery } from '../core/api/paginate';
import { ProspectStatus } from '../core/domain/enums';
import { Prospect } from '../core/domain/models';
import { EntityStore } from './entity.store';

export interface ProspectQuery extends BaseQuery {
  sourceEventId?: number;
  status?: ProspectStatus;
  /** `false` = solo chi non si è ancora iscritto. */
  converted?: boolean;
}

/** Store dell'entità `Prospect` — i contatti dell'open day (`19-prospect.md`). */
@Injectable({ providedIn: 'root' })
export class ProspectStore extends EntityStore<Prospect, ProspectQuery> {
  protected override readonly base = 'prospects';
  /** Il corso di provenienza per il titolo, e quello in cui si è iscritto. */
  protected override readonly listPopulate = 'sourceEvent convertedRegistration.event';
  protected override readonly detailPopulate = 'sourceEvent convertedRegistration.event';
  /**
   * Si legge intero: le azioni della pagina — copiare le email, esportare,
   * segnare contattati — lavorano **sull'elenco filtrato**, e un elenco che si
   * ferma a dieci righe farebbe scrivere a dieci persone su quaranta.
   */
  protected override readonly readsWhole = true;

  /** `POST /prospects/mark-contacted` — dopo aver scritto a tutti. */
  async markContacted(ids: number[]): Promise<number> {
    const { updated } = await this.api.post<{ updated: number }>('/prospects/mark-contacted', { ids });
    await this.load();
    return updated;
  }
}
