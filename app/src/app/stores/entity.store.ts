import { Signal, computed, inject, signal } from '@angular/core';
import { KeijoPaginateResults, KeijoPaginator } from '@keijo/ui';
import { ApiClient } from '../core/api/api.client';
import { PaginateOptions } from '../core/api/paginate';
import { Entity } from '../core/domain/models';

/**
 * Base degli **store per entità** (§5, `AGENTS.md`).
 *
 * Il progetto usa **signals**: nessun NgRx, nessun subject RxJS, nessuna
 * proprietà di classe mutata. La forma è sempre la stessa:
 *
 *  - `signal()` per la collezione, la paginazione e il flag di caricamento;
 *  - `computed()` per le viste derivate;
 *  - metodi `async` che chiamano l'API e poi fanno `set()` / `update()`.
 *
 * Ogni store concreto è `@Injectable({ providedIn: 'root' })` e prende il nome
 * dell'entità in PascalCase più `Store`. Nessuno store «di pagina».
 */
export abstract class EntityStore<T extends Entity, Q extends object = Record<string, unknown>> {
  protected readonly api = inject(ApiClient);

  /** Base REST plurale dell'entità (§3.4). */
  protected abstract readonly base: string;
  /** Relazioni popolate di default sull'elenco. */
  protected readonly listPopulate: string = '';
  /** Relazioni popolate di default sulla lettura singola. */
  protected readonly detailPopulate: string = '';
  /** Ordinamento di default dell'elenco. */
  protected readonly defaultSort: Record<string, 'asc' | 'desc'> = { id: 'desc' };

  private readonly _items = signal<T[]>([]);
  private readonly _current = signal<T | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _page = signal(1);
  private readonly _limit = signal(10);
  private readonly _totalDocs = signal(0);
  private readonly _totalPages = signal(0);
  private readonly _hasNextPage = signal(false);
  private readonly _hasPrevPage = signal(false);
  private readonly _query = signal<Q>({} as Q);
  private readonly _sort = signal<Record<string, 'asc' | 'desc'> | null>(null);

  readonly items: Signal<T[]> = this._items.asReadonly();
  readonly current: Signal<T | null> = this._current.asReadonly();
  readonly loading: Signal<boolean> = this._loading.asReadonly();
  readonly saving: Signal<boolean> = this._saving.asReadonly();
  readonly page: Signal<number> = this._page.asReadonly();
  readonly limit: Signal<number> = this._limit.asReadonly();
  readonly totalDocs: Signal<number> = this._totalDocs.asReadonly();
  readonly totalPages: Signal<number> = this._totalPages.asReadonly();
  readonly query: Signal<Q> = this._query.asReadonly();

  /** Vera solo a caricamento concluso: distingue «vuoto» da «non ancora caricato». */
  readonly isEmpty = computed(() => !this._loading() && this._items().length === 0);

  readonly paginator = computed<KeijoPaginator>(() => ({
    pageIndex: this._page() - 1,
    pageSize: this._limit(),
  }));

  readonly paginateResults = computed<KeijoPaginateResults>(() => ({
    totalDocs: this._totalDocs(),
    page: this._page(),
    totalPages: this._totalPages(),
    hasNextPage: this._hasNextPage(),
    hasPrevPage: this._hasPrevPage(),
  }));

  /** `POST /{plural}/` — elenco paginato e filtrato. */
  async load(options: PaginateOptions = {}): Promise<void> {
    this._loading.set(true);
    try {
      const page = await this.api.list<T, Q>(this.base, this._query(), {
        page: options.page ?? this._page(),
        limit: options.limit ?? this._limit(),
        sort: options.sort ?? this._sort() ?? this.defaultSort,
        populate: options.populate ?? this.listPopulate,
      });
      this._items.set(page.docs ?? []);
      this._totalDocs.set(page.totalDocs ?? 0);
      this._totalPages.set(page.totalPages ?? 0);
      this._page.set(page.page ?? 1);
      this._limit.set(page.limit ?? this._limit());
      this._hasNextPage.set(page.hasNextPage ?? false);
      this._hasPrevPage.set(page.hasPrevPage ?? false);
    } finally {
      this._loading.set(false);
    }
  }

  /** Carica l'elenco completo (fino a `limit`) senza toccare la paginazione della vista. */
  async loadAll(query: Q, limit = 200, populate = this.listPopulate): Promise<T[]> {
    const page = await this.api.list<T, Q>(this.base, query, {
      page: 1,
      limit,
      sort: this.defaultSort,
      populate,
    });
    return page.docs ?? [];
  }

  setQuery(patch: Partial<Q>): Promise<void> {
    this._query.update((current) => ({ ...current, ...patch }) as Q);
    this._page.set(1);
    return this.load({ page: 1 });
  }

  replaceQuery(query: Q): Promise<void> {
    this._query.set(query);
    this._page.set(1);
    return this.load({ page: 1 });
  }

  setSort(sort: Record<string, 'asc' | 'desc'> | null): Promise<void> {
    this._sort.set(sort);
    return this.load({ page: 1 });
  }

  setPage(page: number): Promise<void> {
    this._page.set(page);
    return this.load({ page });
  }

  setPageSize(limit: number): Promise<void> {
    this._limit.set(limit);
    this._page.set(1);
    return this.load({ page: 1, limit });
  }

  /** `GET /{plural}/:id?populate=…` */
  async loadOne(id: number, populate = this.detailPopulate): Promise<T> {
    this._loading.set(true);
    try {
      const entity = await this.api.get<T>(this.base, id, populate);
      this._current.set(entity);
      return entity;
    } finally {
      this._loading.set(false);
    }
  }

  clearCurrent(): void {
    this._current.set(null);
  }

  /** `POST /{plural}/create` */
  async create(dto: unknown): Promise<T> {
    this._saving.set(true);
    try {
      const created = await this.api.create<T>(this.base, dto);
      this._items.update((items) => [created, ...items]);
      this._totalDocs.update((n) => n + 1);
      this._current.set(created);
      return created;
    } finally {
      this._saving.set(false);
    }
  }

  /** `PATCH /{plural}/:id` */
  async update(id: number, patch: unknown): Promise<T> {
    this._saving.set(true);
    try {
      const updated = await this.api.update<T>(this.base, id, patch);
      this.replaceInList(updated);
      if (this._current()?.id === id) this._current.set(updated);
      return updated;
    } finally {
      this._saving.set(false);
    }
  }

  /** `DELETE /{plural}/:id` — cancellazione soft. */
  async remove(id: number): Promise<void> {
    this._saving.set(true);
    try {
      await this.api.remove<T>(this.base, id);
      this._items.update((items) => items.filter((item) => item.id !== id));
      this._totalDocs.update((n) => Math.max(0, n - 1));
      if (this._current()?.id === id) this._current.set(null);
    } finally {
      this._saving.set(false);
    }
  }

  /** Endpoint non-CRUD del §3.7 che restituiscono l'entità aggiornata. */
  protected async runAction(id: number, path: string, body: unknown = {}): Promise<T> {
    this._saving.set(true);
    try {
      const updated = await this.api.post<T>(`/${this.base}/${id}/${path}`, body);
      this.replaceInList(updated);
      if (this._current()?.id === id) this._current.set(updated);
      return updated;
    } finally {
      this._saving.set(false);
    }
  }

  protected replaceInList(entity: T): void {
    this._items.update((items) => items.map((item) => (item.id === entity.id ? entity : item)));
  }

  protected setCurrent(entity: T | null): void {
    this._current.set(entity);
  }
}
