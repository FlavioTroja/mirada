import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';
import {
  ButtonComponent,
  EntityListItemComponent,
  InfoBoxComponent,
  KeijoFilterChange,
  KeijoFilterOption,
  KeijoFilterTab,
  KeijoIconShape,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PaginationComponent,
  PillComponent,
  SearchBarComponent,
  SectionActionButton,
} from '@keijo/ui';
import {
  add,
  cancel as cancelIconShape,
  celebration,
  copyAll,
  eventSeat,
  iconDelete,
  lock,
  lockOpen,
  locationOn,
  publish,
  scale,
  sync,
  visibility,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { EVENT_STATUS_OPTIONS, EVENT_STATUS_UI, EventStatus, StatusUi } from '../../core/domain/enums';
import {
  CapacityQuota,
  EventTypeFamily,
  MiradaEvent,
} from '../../core/domain/models';
import { formatImbalance, formatRange } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { CapacityQuotaStore } from '../../stores/capacity-quota.store';
import { EventStore } from '../../stores/event.store';
import {
  basePathFor,
  collectionLabelFor,
  entityLabelFor,
  familyFromUrl,
} from './event-family';
import { EventTypeStore } from '../../stores/event-type.store';
import { VenueStore } from '../../stores/venue.store';
import { ConfirmService } from '../../shared/confirm.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { DomainErrorComponent } from '../../shared/domain-error.component';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { liveRefresh } from '../../core/realtime/live';
import { REALTIME_EVENTS } from '../../core/realtime/realtime.service';

/** Sintesi di capienza calcolata dalle quote dell'evento. */
interface EventCapacity {
  /** Capienza della sala: `scope=EVENT`, nessun ruolo, nessuna riserva. */
  limit: number | null;
  consumed: number | null;
  leaders: number | null;
  followers: number | null;
  tolerance: number | null;
}

type LifecycleId = 'publish' | 'close-sales' | 'reopen-sales';

interface LifecycleAction {
  id: LifecycleId;
  icon: KeijoIconShape;
  tooltip: string;
}

/**
 * `/events` — elenco degli eventi (§4.2).
 *
 * Colonne dichiarate: titolo, tipo evento, location, date, stato,
 * **venduto/capienza** e **sbilancio ruoli**. Gli ultimi due arrivano dalle
 * `CapacityQuota` dell'evento: il §3 non espone un aggregato di elenco
 * (`GET /events/:id/dashboard` non è ancora attivo), quindi le quote sono lette
 * per i soli eventi della pagina corrente.
 */
@Component({
  selector: 'app-events-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageWrapperComponent,
    PageSectionWrapperComponent,
    SearchBarComponent,
    ListItemsWrapperComponent,
    ListItemsSkeletonComponent,
    EntityListItemComponent,
    PaginationComponent,
    ButtonComponent,
    PillComponent,
    InfoBoxComponent,
    I18nTextComponent,
    AvatarComponent,
    StatusPillComponent,
    DomainErrorComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-domain-error />

      <keijo-page-section-wrapper mode="plain">
        <keijo-search-bar
          [search]="search"
          [filterTabs]="filterTabs()"
          filterTooltip="Filtra gli eventi"
          (filterChanged)="onFilterChanged($event)"
          (removeFiltersFromTab)="onFiltersCleared($event)"
        />

        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (ev of store.items(); track ev.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="headline">
                    <app-avatar
                      shape="portrait"
                      [src]="ev.posterVerticalFile?.url ?? null"
                      [name]="plainTitle(ev)"
                    />
                    <div class="primary">
                      <span class="title"><app-i18n-text [value]="ev.title" /></span>
                      <span class="mirada-muted">{{ range(ev) }}</span>
                    </div>
                  </div>
                </ng-template>

                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="statusUi(ev)" />
                    @if (ev.eventType) {
                      <keijo-pill variant="default" [icon]="typeIcon">
                        <app-i18n-text [value]="ev.eventType.name" />
                      </keijo-pill>
                    }
                    @if (ev.venue) {
                      <keijo-pill variant="default" [icon]="venueIcon">{{
                        ev.venue.name
                      }}</keijo-pill>
                    }
                    @if (capacityOf(ev.id); as cap) {
                      @if (cap.limit !== null) {
                        <keijo-pill
                          variant="info"
                          [icon]="seatIcon"
                          tooltip="Iscritti impegnati sulla capienza della sala"
                        >
                          {{ cap.consumed }}/{{ cap.limit }}
                        </keijo-pill>
                      }
                      @if (cap.leaders !== null) {
                        <keijo-pill
                          variant="default"
                          [icon]="balanceIcon"
                          tooltip="Sbilancio corrente fra i due ruoli, con la tolleranza configurata"
                        >
                          {{ imbalance(cap) }}
                        </keijo-pill>
                      }
                    }
                  </div>
                </ng-template>

                <ng-template #actions>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Elimina l’evento"
                      (action)="remove(ev)"
                    />
                  }
                  @if (canWrite() && canCancel(ev)) {
                    <keijo-button
                      variant="error"
                      [icon]="cancelIcon"
                      tooltip="Annulla l’evento"
                      (action)="cancel(ev)"
                    />
                  }
                  <!--
                    Qui c'era anche un pulsante «Modifica i dati base» (warning)
                    collegato allo stesso open(ev) del pulsante accent: due
                    etichette e due colori per un unico comportamento. La scheda
                    dell'evento è già un form editabile, quindi non esiste una
                    «modifica» distinta dall'apertura da offrire.
                    (keijo-fe-check, 4 agosto 2026, rilievo A4.)
                  -->
                  @if (canWrite()) {
                    <keijo-button
                      variant="default"
                      [icon]="duplicateIcon"
                      tooltip="Duplica come nuova edizione"
                      (action)="duplicate(ev)"
                    />
                  }
                  @if (lifecycleAction(ev); as action) {
                    <keijo-button
                      variant="default"
                      [icon]="action.icon"
                      [tooltip]="action.tooltip"
                      (action)="runLifecycle(ev, action.id)"
                    />
                  }
                  <keijo-button
                    variant="accent"
                    [icon]="viewIcon"
                    tooltip="Apri il workspace dell’evento"
                    (action)="open(ev)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box
                [icon]="emptyIcon"
                title="Nessun evento"
                variant="info"
                [actions]="canWrite() ? emptyActions : []"
                (actionClick)="create()"
              >
                <span>
                  Non c’è ancora un evento che corrisponda ai filtri attivi. Il primo passo del
                  workspace è la creazione dei dati base; sessioni, titoli d’ingresso e quote si
                  aggiungono subito dopo.
                </span>
              </keijo-info-box>
            }
          </keijo-list-items-wrapper>
        }

        <keijo-pagination
          [paginator]="store.paginator()"
          [paginateResults]="store.paginateResults()"
          (pageChange)="onPage($event)"
          (pageSizeChange)="onPageSize($event)"
        />
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .headline {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        min-width: 0;
      }
      .primary {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        min-width: 0;
      }
      .title {
        font-weight: 600;
      }
      .secondary {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
    `,
  ],
})
export class EventsListComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly eventTypes = inject(EventTypeStore);
  private readonly venues = inject(VenueStore);
  private readonly quotas = inject(CapacityQuotaStore);

  readonly store = inject(EventStore);

  /**
   * **Da quale porta si è entrati**, e quindi cosa questa pagina elenca.
   *
   * `/events` e `/courses` sono lo stesso componente su famiglie diverse
   * (`event-family.ts`): la lista, il titolo, l'azione di creazione e il percorso
   * di apertura seguono tutti da qui.
   */
  readonly family: EventTypeFamily = familyFromUrl(this.router.url);
  private readonly base = basePathFor(this.family);

  readonly search = new FormControl('', { nonNullable: true });
  private readonly capacities = signal<Record<number, EventCapacity>>({});
  private readonly typeOptions = signal<KeijoFilterOption[]>([]);

  readonly typeIcon = celebration;
  readonly venueIcon = locationOn;
  readonly seatIcon = eventSeat;
  readonly balanceIcon = scale;
  readonly viewIcon = visibility;
  readonly deleteIcon = iconDelete;
  readonly duplicateIcon = copyAll;
  readonly cancelIcon = cancelIconShape;
  readonly emptyIcon = celebration;

  readonly emptyActions: SectionActionButton[] = [
    { id: 'create', icon: add, label: 'Crea ' + entityLabelFor(this.family).toLowerCase(), variant: 'accent' },
  ];

  readonly canWrite = computed(() => this.auth.can().eventsWrite);
  readonly canPublish = computed(() => this.auth.can().publishEvent);

  readonly filterTabs = computed<KeijoFilterTab[]>(() => [
    {
      field: 'status',
      name: 'Stato',
      kind: 'multi',
      selectIds: [],
      options: EVENT_STATUS_OPTIONS.map((o) => ({ id: o.value, name: o.label, checked: false })),
    },
    {
      field: 'eventTypeId',
      name: 'Tipo evento',
      kind: 'single',
      selectIds: [],
      options: this.typeOptions(),
    },
    {
      field: 'venueId',
      name: 'Location',
      kind: 'entity',
      selectIds: [],
      searcher: true,
      searchValue: new FormControl(''),
      optionsSource: (term: string) => this.searchVenues(term),
    },
  ]);

  constructor() {
    // Le capienze mostrate in elenco sono lette una per evento: si rileggono
    // tutte, perche il frame dice che una si e mossa e non quale colonna.
    liveRefresh([REALTIME_EVENTS.availabilityChanged], () => this.loadCapacities());

    this.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((value) => void this.applyQuery({ value: value || undefined }));
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set(collectionLabelFor(this.family));
    this.registerActions();
    // ⚠️ Il filtro di famiglia è nella query, non un `filter()` sul risultato:
    // la separazione dev'essere COMPLETA e paginata. Filtrare a valle darebbe
    // pagine di lunghezza variabile e un conteggio che mente.
    await this.store.replaceQuery({ eventTypeFamily: this.family });
    await this.loadCapacities();
    await this.loadTypeOptions();
  }

  // -- azioni di testata ----------------------------------------------------

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite()) {
      // Primaria = CRUD dell'entità di pagina, etichetta di una sola parola.
      actions.push({
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: `Crea un nuovo ${entityLabelFor(this.family).toLowerCase()}`,
        run: () => this.create(),
      });
    }
    actions.push({
      id: 'refresh',
      icon: sync,
      label: 'Aggiorna',
      tooltip: 'Ricarica l’elenco',
      run: () => void this.reload(),
    });
    this.pageActions.set(actions);
  }

  create(): void {
    void this.router.navigateByUrl(`${this.base}/new`);
  }

  open(ev: MiradaEvent): void {
    void this.router.navigateByUrl(`${this.base}/${ev.id}`);
  }

  private async reload(): Promise<void> {
    await this.store.load();
    await this.loadCapacities();
  }

  // -- filtri ---------------------------------------------------------------

  onFilterChanged(change: KeijoFilterChange): void {
    const ids = Array.isArray(change.value) ? change.value : [];
    switch (change.field) {
      case 'status':
        void this.applyQuery({ status: ids.length ? (ids as EventStatus[]) : undefined });
        break;
      case 'eventTypeId':
        void this.applyQuery({ eventTypeId: ids.length ? Number(ids[0]) : undefined });
        break;
      case 'venueId':
        void this.applyQuery({ venueId: ids.length ? Number(ids[0]) : undefined });
        break;
    }
  }

  onFiltersCleared(field: string): void {
    void this.applyQuery({ [field]: undefined });
  }

  private async applyQuery(patch: Record<string, unknown>): Promise<void> {
    await this.store.setQuery(patch);
    await this.loadCapacities();
  }

  onPage(page: number): void {
    void this.store.setPage(page).then(() => this.loadCapacities());
  }

  onPageSize(size: number): void {
    void this.store.setPageSize(size).then(() => this.loadCapacities());
  }

  private async searchVenues(term: string): Promise<KeijoFilterOption[]> {
    const docs = await this.venues.loadAll({ value: term || undefined }, 25, '');
    return docs.map((v) => ({ id: v.id, name: v.name, checked: false }));
  }

  private async loadTypeOptions(): Promise<void> {
    // Solo i tipi di QUESTA famiglia: offrire «Festival» fra i filtri della
    // lista dei corsi darebbe un filtro che non può mai trovare nulla.
    const docs = (await this.eventTypes.loadAll({ active: true }, 100, '')).filter(
      (t) => t.family === this.family,
    );
    this.typeOptions.set(
      docs.map((t) => ({ id: t.id, name: i18nPlain(t.name, this.locale.lang()), checked: false })),
    );
  }

  // -- capienza e sbilancio -------------------------------------------------

  /**
   * Le quote sono lette per gli eventi della pagina corrente. Nessun aggregato
   * di elenco è dichiarato nel §3, e un conteggio inventato lato client sarebbe
   * peggio di nessun conteggio (`RB21`).
   */
  private async loadCapacities(): Promise<void> {
    const events = this.store.items();
    if (!events.length) {
      this.capacities.set({});
      return;
    }
    const entries = await Promise.all(
      events.map(async (ev) => {
        try {
          const rows = await this.quotas.loadAll({ eventId: ev.id }, 100, '');
          return [ev.id, summarize(rows)] as const;
        } catch {
          return [ev.id, emptyCapacity()] as const;
        }
      }),
    );
    this.capacities.set(Object.fromEntries(entries));
  }

  capacityOf(eventId: number): EventCapacity | null {
    return this.capacities()[eventId] ?? null;
  }

  imbalance(cap: EventCapacity): string {
    return formatImbalance(cap.leaders ?? 0, cap.followers ?? 0, cap.tolerance);
  }

  // -- riga -----------------------------------------------------------------

  range(ev: MiradaEvent): string {
    return formatRange(ev.startAt, ev.endAt);
  }

  /**
   * Il titolo in testo semplice, per ricavarne le iniziali quando la locandina
   * manca. Il titolo è multilingua: si prende quello della lingua in uso, così
   * l'evento inglese non dà le iniziali del titolo italiano.
   */
  plainTitle(ev: MiradaEvent): string {
    return i18nPlain(ev.title, this.locale.lang(), '');
  }

  statusUi(ev: MiradaEvent): StatusUi {
    return EVENT_STATUS_UI[ev.status];
  }

  canCancel(ev: MiradaEvent): boolean {
    return ev.status !== 'CANCELLED' && ev.status !== 'ARCHIVED';
  }

  /** L'azione di ciclo di vita disponibile in questo stato — una sola per riga. */
  lifecycleAction(ev: MiradaEvent): LifecycleAction | null {
    if (!this.canPublish()) return null;
    switch (ev.status) {
      case 'DRAFT':
        return { id: 'publish', icon: publish, tooltip: 'Pubblica l’evento' };
      case 'PUBLISHED':
        return { id: 'close-sales', icon: lock, tooltip: 'Chiudi le vendite online' };
      case 'SALES_CLOSED':
        return { id: 'reopen-sales', icon: lockOpen, tooltip: 'Riapri le vendite online' };
      default:
        return null;
    }
  }

  async runLifecycle(ev: MiradaEvent, id: LifecycleId): Promise<void> {
    try {
      if (id === 'publish') {
        await this.store.publish(ev.id);
        this.toast.show('SUCCESS', 'Evento pubblicato: le prenotazioni sono aperte.');
      } else if (id === 'close-sales') {
        const ok = await this.confirm.ask({
          title: 'Chiudere le vendite online?',
          message:
            'L’evento si svolge regolarmente e i biglietti già emessi restano validi: si chiude ' +
            'solo la vendita online. Potrai riaprirla in qualsiasi momento.',
          confirmLabel: 'Chiudi vendite',
        });
        if (!ok) return;
        await this.store.closeSales(ev.id);
        this.toast.show('SUCCESS', 'Vendite online chiuse.');
      } else {
        await this.store.reopenSales(ev.id);
        this.toast.show('SUCCESS', 'Vendite online riaperte.');
      }
    } catch {
      // Gli errori di dominio (`PAYOUT_NOT_ENABLED`, `SALES_CLOSED`) li presenta
      // <app-domain-error>; gli altri sono già a carico dell'interceptor.
    }
  }

  async duplicate(ev: MiradaEvent): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Duplicare l’evento?',
      message:
        'Viene creata una nuova edizione in bozza con sessioni, titoli d’ingresso, requisiti e ' +
        'servizi copiati. Vendite e iscrizioni della nuova edizione partono azzerate.',
      confirmLabel: 'Duplica',
    });
    if (!ok) return;
    const created = await this.store.duplicate(ev.id);
    this.toast.show('SUCCESS', 'Nuova edizione creata in bozza.');
    void this.router.navigateByUrl(`/events/${created.id}`);
  }

  /**
   * L'annullamento richiede una **motivazione obbligatoria** che viene
   * registrata: si compila nella scheda dell'evento, dove c'è il campo, non in
   * un dialogo di elenco senza testo libero (`RF-EVT-41`).
   */
  async cancel(ev: MiradaEvent): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Annullare l’evento?',
      message:
        'L’annullamento chiude le vendite e segna l’evento come annullato per tutti gli iscritti. ' +
        'Serve una motivazione, che viene registrata: la compili nella scheda dell’evento.',
      confirmLabel: 'Vai alla scheda',
      cancelLabel: 'Torna indietro',
      destructive: true,
    });
    if (!ok) return;
    void this.router.navigateByUrl(`/events/${ev.id}`);
  }

  async remove(ev: MiradaEvent): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare l’evento?',
      message:
        `«${i18nPlain(ev.title, this.locale.lang())}» viene rimosso dagli elenchi. ` +
        'Se ha già iscritti o vendite, l’operazione corretta è l’annullamento, non l’eliminazione.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(ev.id);
    this.toast.show('SUCCESS', 'Evento eliminato.');
  }
}

function emptyCapacity(): EventCapacity {
  return { limit: null, consumed: null, leaders: null, followers: null, tolerance: null };
}

function summarize(rows: CapacityQuota[]): EventCapacity {
  const venue = rows.find((q) => q.scope === 'EVENT' && !q.role && !q.reservedFor) ?? null;
  const leader =
    rows.find((q) => q.scope === 'EVENT' && q.role === 'LEADER' && !q.reservedFor) ?? null;
  const follower =
    rows.find((q) => q.scope === 'EVENT' && q.role === 'FOLLOWER' && !q.reservedFor) ?? null;

  return {
    limit: venue ? venue.limit : null,
    consumed: venue ? venue.consumed : null,
    leaders: leader ? leader.consumed : null,
    followers: follower ? follower.consumed : null,
    tolerance: leader?.imbalanceTolerance ?? follower?.imbalanceTolerance ?? null,
  };
}
