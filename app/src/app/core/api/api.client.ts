import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError, parseApiError } from './api-error';
import { PaginateDatasource, PaginateOptions } from './paginate';

/** Prefisso globale del §3.1. Nessun versionamento in URL. */
export const API_PREFIX = '/api';

/**
 * Client del **dialetto REST keijo** (§3.2). Le forme sono quelle dichiarate nel
 * brief e non vanno «corrette»: elenco e creazione sono `POST`.
 *
 * | Intento                        | Forma                                     |
 * |--------------------------------|-------------------------------------------|
 * | Elenco paginato e filtrato     | `POST /{plural}/`  body `{ query, options }` |
 * | Creazione                      | `POST /{plural}/create`                   |
 * | Lettura singola                | `GET  /{plural}/:id?populate=…`           |
 * | Aggiornamento parziale         | `PATCH /{plural}/:id`                     |
 * | Cancellazione (soft)           | `DELETE /{plural}/:id`                    |
 * | Collezione figlia              | `PATCH /{plural}/:id/<subs>` con l'array intero |
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  private url(path: string): string {
    return `${API_PREFIX}${path}`;
  }

  private async run<T>(request: Promise<T>): Promise<T> {
    try {
      return await request;
    } catch (err) {
      throw parseApiError(err);
    }
  }

  /** `POST /{plural}/` — elenco paginato e filtrato. */
  list<T, Q extends object = Record<string, unknown>>(
    base: string,
    query: Q,
    options: PaginateOptions = {},
  ): Promise<PaginateDatasource<T>> {
    return this.run(
      firstValueFrom(
        this.http.post<PaginateDatasource<T>>(this.url(`/${base}/`), {
          query: stripUndefined(query),
          options: {
            page: options.page ?? 1,
            limit: options.limit ?? 10,
            ...(options.sort ? { sort: options.sort } : {}),
            populate: options.populate ?? '',
          },
        }),
      ),
    );
  }

  /** `POST /{plural}/create` — creazione. */
  create<T>(base: string, body: unknown): Promise<T> {
    return this.run(firstValueFrom(this.http.post<T>(this.url(`/${base}/create`), body)));
  }

  /** `GET /{plural}/:id?populate=<relazioni separate da spazio>` */
  get<T>(base: string, id: number, populate = ''): Promise<T> {
    const params = populate ? new HttpParams().set('populate', populate) : undefined;
    return this.run(firstValueFrom(this.http.get<T>(this.url(`/${base}/${id}`), { params })));
  }

  /** `PATCH /{plural}/:id` — aggiornamento parziale. */
  update<T>(base: string, id: number, patch: unknown): Promise<T> {
    return this.run(firstValueFrom(this.http.patch<T>(this.url(`/${base}/${id}`), patch)));
  }

  /** `DELETE /{plural}/:id` — cancellazione soft. */
  remove<T>(base: string, id: number): Promise<T> {
    return this.run(firstValueFrom(this.http.delete<T>(this.url(`/${base}/${id}`))));
  }

  /**
   * `PATCH /{plural}/:id/<subs>` con **l'array intero**:
   * `id: -1` = riga nuova, `toBeDisconnected: true` = riga rimossa (§3.2).
   */
  patchChildren<T>(base: string, id: number, subs: string, rows: unknown[]): Promise<T> {
    return this.run(firstValueFrom(this.http.patch<T>(this.url(`/${base}/${id}/${subs}`), rows)));
  }

  /**
   * `PUT /{plural}/:id/<subs>` con **l'array intero** — la stessa forma di
   * `patchChildren`, con il verbo che quelle rotte dichiarano.
   *
   * I due verbi convivono perché il backend non è uniforme: i figli di
   * `TicketType` si scrivono in `PATCH`, quelli di `SalesChannel` in `PUT`.
   * Allinearli sarebbe una modifica di contratto, e sceglierne uno a caso qui
   * produrrebbe un `404` che sembra un problema di rotta.
   */
  putChildren<T>(base: string, id: number, subs: string, rows: unknown[]): Promise<T> {
    return this.run(firstValueFrom(this.http.put<T>(this.url(`/${base}/${id}/${subs}`), rows)));
  }

  /** Endpoint non-CRUD del §3.7 — elenco chiuso, mai inferito. */
  post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.run(firstValueFrom(this.http.post<T>(this.url(path), body)));
  }

  /** Endpoint non-CRUD del §3.7 in lettura. */
  fetch<T>(path: string): Promise<T> {
    return this.run(firstValueFrom(this.http.get<T>(this.url(path))));
  }

  /**
   * Upload binario `multipart/form-data` — **unica eccezione** al «niente
   * multipart» del §3.2 (§3.7). Nessun `Content-Type` esplicito: il browser
   * deve poter comporre il `boundary` da sé.
   */
  upload<T>(path: string, form: FormData): Promise<T> {
    return this.run(firstValueFrom(this.http.post<T>(this.url(path), form)));
  }
}

/** Il backend valida con Zod: le chiavi `undefined` vanno tolte, non inviate. */
export function stripUndefined<T extends object>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (v !== undefined) out[key] = v;
  }
  return out as T;
}

export { ApiError };
