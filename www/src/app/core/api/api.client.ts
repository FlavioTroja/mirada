import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiError, parseApiError } from './api-error';
import { PaginateDatasource, PaginateOptions } from './paginate';

/** Prefisso globale del §3.1. Nessun versionamento in URL. */
export const API_PREFIX = '/api';

/**
 * Client del **dialetto REST keijo** (§3.2): elenco e creazione sono `POST`, e
 * non vanno «corretti».
 *
 * **SSR.** Nel browser l'URL resta relativo (`/api/…`, servito dal proxy di
 * sviluppo e dal reverse proxy in esercizio). Sul server `fetch` non ha
 * un'origine da cui risolvere un percorso relativo, quindi l'URL viene reso
 * assoluto verso il backend: senza questo, la prima resa di ogni pagina
 * fallirebbe in silenzio e resterebbe vuota — che è esattamente ciò che questa
 * applicazione esiste per evitare.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Origine del backend usata **solo** durante la resa lato server. */
  private readonly serverOrigin =
    (typeof process !== 'undefined' && process.env?.['API_ORIGIN']) || 'http://localhost:5000';

  private url(path: string): string {
    return this.isBrowser ? `${API_PREFIX}${path}` : `${this.serverOrigin}${API_PREFIX}${path}`;
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
            limit: options.limit ?? 12,
            ...(options.sort ? { sort: options.sort } : {}),
            populate: options.populate ?? '',
          },
        }),
      ),
    );
  }

  /** Endpoint non-CRUD del §3.7 in lettura. */
  fetch<T>(path: string, params?: Record<string, string>): Promise<T> {
    const httpParams = params
      ? Object.entries(params).reduce((p, [k, v]) => p.set(k, v), new HttpParams())
      : undefined;
    return this.run(firstValueFrom(this.http.get<T>(this.url(path), { params: httpParams })));
  }

  /** Endpoint non-CRUD del §3.7 in scrittura — elenco chiuso, mai inferito. */
  post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.run(firstValueFrom(this.http.post<T>(this.url(path), body)));
  }
}

/** Il backend valida con Zod: le chiavi `undefined` vanno tolte, non inviate. */
export function stripUndefined<T extends object>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (v !== undefined && v !== null && v !== '') out[key] = v;
  }
  return out as T;
}

export { ApiError };
