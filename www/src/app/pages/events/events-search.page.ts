import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { EventStore } from '../../stores/event.store';
import { SeoService } from '../../core/seo/seo.service';
import { PublicEventQuery } from '../../core/domain/models';
import { EventCardComponent } from './event-card.component';
import { EventFiltersComponent } from './event-filters.component';

/**
 * `/eventi` — ricerca pubblica con filtri, `POST /api/public/events/` (§3.7),
 * **senza autenticazione** e paginata.
 *
 * I filtri vivono nella **query string**: un risultato di ricerca dev'essere un
 * indirizzo che si può mandare a un'amica, e la resa lato server deve poterlo
 * ricostruire senza JavaScript.
 */
@Component({
  selector: 'app-events-search',
  imports: [EventCardComponent, EventFiltersComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="www-wrap">
      <header class="head">
        <h1 class="www-h1">Eventi di tango argentino</h1>
        <p class="www-lead">
          Festival, marathon, encuentro e stage. Cerca per città, regione, periodo e — soprattutto —
          per il tuo ruolo di ballo.
        </p>
      </header>

      <app-event-filters [initial]="query()" (changed)="onSearch($event)" />

      <section class="results" aria-live="polite">
        <p class="count">
          @if (store.searching()) {
            Ricerca in corso…
          } @else {
            {{ store.total() }}
            {{ store.total() === 1 ? 'evento trovato' : 'eventi trovati' }}
            @if (activeRoleLabel()) {
              <span class="www-chip www-chip-accent">con posti {{ activeRoleLabel() }}</span>
            }
          }
        </p>

        @if (store.searchError()) {
          <div class="www-notice www-notice-error">
            <strong>Ricerca non riuscita</strong>
            {{ store.searchError() }}
          </div>
        } @else if (!store.searching() && store.results().length === 0) {
          <div class="www-notice www-notice-info">
            <strong>Nessun evento con questi filtri</strong>
            Prova ad allargare il periodo, a togliere la regione, oppure a rimettere il ruolo su
            «indifferente»: il filtro di ruolo nasconde gli eventi che non hanno più posto proprio
            per quel ruolo, anche se ne hanno per l’altro.
          </div>
        } @else {
          <div class="grid">
            @for (event of store.results(); track event.id) {
              <app-event-card [event]="event" />
            }
          </div>
        }

        @if (store.pagination().totalPages > 1) {
          <nav class="pager" aria-label="Pagine dei risultati">
            <button
              type="button"
              class="www-btn www-btn-secondary"
              [disabled]="!store.pagination().hasPrevPage"
              (click)="goToPage(store.pagination().page - 1)"
            >
              Precedente
            </button>
            <span class="www-muted">
              Pagina {{ store.pagination().page }} di {{ store.pagination().totalPages }}
            </span>
            <button
              type="button"
              class="www-btn www-btn-secondary"
              [disabled]="!store.pagination().hasNextPage"
              (click)="goToPage(store.pagination().page + 1)"
            >
              Successiva
            </button>
          </nav>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .head {
        margin-bottom: 1.5rem;
      }
      .results {
        margin-top: 2rem;
      }
      .count {
        color: rgba(var(--text-rgb), 0.75);
        margin: 0 0 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(24rem, 1fr));
        gap: 1rem;
      }
      .pager {
        margin-top: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
      }
      @media (max-width: 560px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class EventsSearchPage {
  protected readonly store = inject(EventStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  private readonly params = toSignal(this.route.queryParams, {
    initialValue: this.route.snapshot.queryParams as Params,
  });

  protected readonly query = computed<PublicEventQuery>(() => queryFromParams(this.params()));

  protected readonly activeRoleLabel = computed(() => {
    const role = this.query().role;
    return role === 'LEADER' ? 'leader' : role === 'FOLLOWER' ? 'follower' : '';
  });

  constructor() {
    this.seo.apply({
      title: 'Eventi di tango argentino — Mirada Tango',
      description:
        'Cerca festival, marathon, encuentro e stage di tango argentino per città, regione, ' +
        'periodo e ruolo di ballo, e iscriviti online.',
      path: '/eventi',
    });
    this.seo.setJsonLd(null);
  }

  protected onSearch(query: PublicEventQuery): void {
    void this.router.navigate(['/eventi'], {
      queryParams: paramsFromQuery(query),
      replaceUrl: false,
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate(['/eventi'], {
      queryParams: { ...paramsFromQuery(this.query()), pagina: page },
    });
  }
}

/** La query string è in italiano: è un indirizzo che il pubblico legge. */
export function queryFromParams(params: Params): PublicEventQuery {
  const q: PublicEventQuery = {};
  if (params['cerca']) q.value = String(params['cerca']);
  if (params['citta']) q.city = String(params['citta']);
  if (params['provincia']) q.province = String(params['provincia']).toUpperCase();
  if (params['regione']) q.region = String(params['regione']);
  if (params['dal']) q.from = String(params['dal']);
  if (params['al']) q.to = String(params['al']);
  const role = params['ruolo'];
  if (role === 'LEADER' || role === 'FOLLOWER') q.role = role;
  return q;
}

export function paramsFromQuery(query: PublicEventQuery): Params {
  return {
    cerca: query.value || null,
    citta: query.city || null,
    provincia: query.province || null,
    regione: query.region || null,
    dal: query.from || null,
    al: query.to || null,
    ruolo: query.role || null,
    pagina: null,
  };
}

export function pageFromParams(params: Params): number {
  const raw = Number(params['pagina']);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}
