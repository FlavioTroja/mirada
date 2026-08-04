/**
 * Buste di paginazione del §3.3 del frontend-brief.
 *
 * Nessun wrapper sul successo: la lista arriva come `PaginateDatasource<T>`,
 * l'entità singola arriva grezza.
 */

export interface PaginateDatasource<T> {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  page: number;
  limit: number;
  prevPage?: number | null;
  nextPage?: number | null;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

/** `options` del corpo `{ query, options }` (§3.3). */
export interface PaginateOptions {
  page?: number;
  limit?: number;
  /** `{ campo: 'asc' | 'desc' }` */
  sort?: Record<string, 'asc' | 'desc'>;
  /** Relazioni da popolare, separate da spazio. */
  populate?: string;
}

/** Parte comune di ogni `query`: la ricerca full-text. */
export interface BaseQuery {
  value?: string;
}

export function emptyPage<T>(limit = 10): PaginateDatasource<T> {
  return {
    docs: [],
    totalDocs: 0,
    totalPages: 0,
    page: 1,
    limit,
    prevPage: null,
    nextPage: null,
    hasPrevPage: false,
    hasNextPage: false,
  };
}
