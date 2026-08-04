import { Injectable, inject, signal } from '@angular/core';
import { ApiClient, ApiError } from '../core/api/api.client';
import { ExportKind, ExportResult } from '../core/domain/dashboard';

/**
 * Esito di un `kind` non ancora producibile: `501` **con il motivo esplicito**
 * (§3.7). Non è un fallimento e non va mostrato come tale — e soprattutto non
 * va sostituito da un tracciato vuoto, che sembrerebbe un dato.
 */
export interface ExportUnavailable {
  kind: ExportKind;
  reason: string;
}

/** Colonna non ammessa: `400` con l'elenco delle valide (`RB12`). */
export interface ExportRejected {
  kind: ExportKind;
  message: string;
}

/**
 * Store delle esportazioni — `POST /events/:id/exports` (§3.7, §4.7).
 *
 * Le colonne sono un **elenco chiuso** deciso dal backend: non contengono
 * contatti oltre l'email del titolare, né contenuto dei requisiti, né diete o
 * allergie (`RB12`). Il frontend non le inventa: le riceve nell'esito della
 * generazione e le ripropone per le generazioni successive.
 */
@Injectable({ providedIn: 'root' })
export class ReportStore {
  private readonly api = inject(ApiClient);

  private readonly _generating = signal(false);
  private readonly _results = signal<ExportResult[]>([]);
  private readonly _unavailable = signal<Record<string, ExportUnavailable>>({});
  private readonly _rejected = signal<ExportRejected | null>(null);
  /** Colonne ammesse per `kind`, apprese dall'esito della generazione. */
  private readonly _knownColumns = signal<Record<string, string[]>>({});

  readonly generating = this._generating.asReadonly();
  readonly results = this._results.asReadonly();
  readonly unavailable = this._unavailable.asReadonly();
  readonly rejected = this._rejected.asReadonly();
  readonly knownColumns = this._knownColumns.asReadonly();

  columnsFor(kind: ExportKind): string[] {
    return this._knownColumns()[kind] ?? [];
  }

  reasonFor(kind: ExportKind): string | null {
    return this._unavailable()[kind]?.reason ?? null;
  }

  clearRejection(): void {
    this._rejected.set(null);
  }

  /**
   * `POST /events/:id/exports` body `{ kind, columns[] }`.
   *
   * Restituisce l'esito oppure `null` quando il `kind` non è producibile: in
   * quel caso il motivo finisce in `unavailable`, non in un toast d'errore.
   */
  async generate(
    eventId: number,
    kind: ExportKind,
    columns: string[] = [],
  ): Promise<ExportResult | null> {
    this._generating.set(true);
    this._rejected.set(null);
    try {
      const result = await this.api.post<ExportResult>(`/events/${eventId}/exports`, {
        kind,
        ...(columns.length ? { columns } : {}),
      });
      this._results.update((all) => [result, ...all].slice(0, 20));
      this._knownColumns.update((map) => ({ ...map, [kind]: result.columns ?? [] }));
      this._unavailable.update((map) => {
        const next = { ...map };
        delete next[kind];
        return next;
      });
      return result;
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'not-implemented') {
        this._unavailable.update((map) => ({ ...map, [kind]: { kind, reason: err.message } }));
        return null;
      }
      if (err instanceof ApiError && err.status === 400) {
        this._rejected.set({ kind, message: err.message });
        return null;
      }
      throw err;
    } finally {
      this._generating.set(false);
    }
  }

  /**
   * Interroga un `kind` per sapere se è producibile. Il contratto non espone un
   * «elenco dei kind disponibili»: l'unico modo di saperlo è chiedere, e un
   * `kind` non producibile risponde `501` **senza generare nulla**.
   *
   * La pagina lo usa **solo su `SALES_BY_SESSION`**, perché il §4.7 chiede che
   * quella esportazione sia visibile *e dichiarata indisponibile* senza che
   * l'organizzatore debba scoprirlo provando: nasconderne lo stato la farebbe
   * dimenticare, ed è una delle tre condizioni del posizionamento fiscale.
   */
  async probe(eventId: number, kind: ExportKind): Promise<void> {
    try {
      await this.generate(eventId, kind);
    } catch {
      /* rete o permessi: la pagina resta senza dichiarazione per quel kind */
    }
  }
}
