import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';
import {
  ButtonComponent,
  EntityListItemComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  KeijoFilterChange,
  KeijoFilterTab,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PaginationComponent,
  PillComponent,
  SearchBarComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import {
  add,
  block,
  celebration,
  check,
  checkCircle,
  close,
  domain,
  visibility,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import {
  ORGANIZATION_STATUS_OPTIONS,
  ORGANIZATION_STATUS_UI,
  OrganizationStatus,
  PAYOUT_STATUS_UI,
  PayoutStatus,
} from '../../core/domain/enums';
import { Organization } from '../../core/domain/models';
import { EventStore } from '../../stores/event.store';
import { OrganizationStore } from '../../stores/organization.store';
import { ConfirmService } from '../../shared/confirm.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { ApiClient } from '../../core/api/api.client';

/** Solo ciò che serve a comporre la voce dell'elenco: nessun dato personale in più. */
interface UserRow {
  id: number;
  username: string;
}

/**
 * `/platform/organizations` — l'elenco delle organizzazioni (§4.10, `GOD`).
 *
 * Nel primo taglio le organizzazioni sono **create a mano dal Super Admin**:
 * non c'è coda di approvazione né onboarding self-service. La creazione è
 * quindi diretta.
 *
 * Il «venduto» previsto dal §4.10 richiede `Order`, che il contratto condiviso
 * non espone ancora: la colonna comparirà quando ci sarà. Gli **eventi
 * pubblicati** sono invece contati sugli eventi della pagina corrente.
 */
@Component({
  selector: 'app-platform-organizations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
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
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    SelectComponent,
    AvatarComponent,
    StatusPillComponent,
  ],
  template: `
    <keijo-page-wrapper>
      @if (editing()) {
        <keijo-page-section-wrapper
          title="Nuova organizzazione"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          <p class="mirada-hint">
            Nel primo taglio le organizzazioni si creano a mano: non c’è una coda di approvazione
            e non c’è onboarding self-service. L’abilitazione all’incasso resta una verifica
            separata presso il prestatore di pagamento.
          </p>
          <p class="mirada-hint">
            <strong>Il titolare è obbligatorio.</strong> La stai aprendo per conto di qualcuno:
            la persona che indichi qui diventa proprietaria dell’organizzazione e riceve il ruolo
            che le serve per amministrarla. Senza, l’organizzazione resterebbe tua.
          </p>
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.name"
                label="denominazione"
                id="newOrgName"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.legalName"
                label="ragione sociale"
                id="newOrgLegalName"
                type="text"
              />
            </keijo-form-row>
            @if (err('name'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.legalForm"
                label="forma giuridica"
                id="newOrgLegalForm"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.contactEmail"
                label="email di riferimento"
                id="newOrgEmail"
                type="email"
              />
            </keijo-form-row>
            @if (err('contactEmail'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="1">
              <keijo-select
                [formControl]="form.controls.ownerUserId"
                [data]="userOptions()"
                label="titolare"
                placeholder="Scegli chi sarà proprietario dell’organizzazione"
              />
            </keijo-form-row>
            @if (err('ownerUserId'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        <keijo-search-bar
          [search]="search"
          [filterTabs]="filterTabs"
          filterTooltip="Filtra le organizzazioni"
          (filterChanged)="onFilterChanged($event)"
        />

        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (org of store.items(); track org.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="headline">
                    <app-avatar
                      shape="square"
                      [src]="org.logoFile?.url ?? null"
                      [name]="org.name"
                    />
                    <div class="primary">
                      <span class="title">{{ org.name }}</span>
                      <span class="mirada-muted">{{ org.legalName }} · {{ org.contactEmail }}</span>
                    </div>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="statusUi(org.status)" />
                    <app-status-pill [status]="payoutUi(org.payoutStatus)" />
                    @if (publishedCount(org.id) !== null) {
                      <keijo-pill variant="default" [icon]="eventIcon">
                        {{ publishedCount(org.id) }} eventi pubblicati
                      </keijo-pill>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  @if (org.status === 'SUSPENDED') {
                    <keijo-button
                      variant="default"
                      [icon]="reactivateIcon"
                      tooltip="Riattiva l’organizzazione"
                      (action)="setStatus(org, 'APPROVED')"
                    />
                  } @else {
                    <keijo-button
                      variant="error"
                      [icon]="suspendIcon"
                      tooltip="Sospendi l’organizzazione"
                      (action)="setStatus(org, 'SUSPENDED')"
                    />
                  }
                  <keijo-button
                    variant="accent"
                    [icon]="viewIcon"
                    tooltip="Apri la scheda dell’organizzazione"
                    (action)="open(org)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="orgIcon" title="Nessuna organizzazione" variant="info">
                <span>
                  Senza organizzazioni non esistono eventi: l’organizzazione è il contenitore di
                  location, cast, eventi e incassi.
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
export class PlatformOrganizationsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly events = inject(EventStore);
  private readonly api = inject(ApiClient);

  readonly store = inject(OrganizationStore);

  readonly orgIcon = domain;
  readonly eventIcon = celebration;
  readonly viewIcon = visibility;
  readonly suspendIcon = block;
  readonly reactivateIcon = checkCircle;

  readonly search = new FormControl('', { nonNullable: true });
  readonly editing = signal(false);
  readonly formErrors = signal<string[]>([]);
  private readonly published = signal<Record<number, number>>({});
  /** Gli utenti fra cui scegliere il titolare. */
  readonly userOptions = signal<SelectOption[]>([]);

  readonly filterTabs: KeijoFilterTab[] = [
    {
      field: 'status',
      name: 'Stato',
      kind: 'multi',
      selectIds: [],
      options: ORGANIZATION_STATUS_OPTIONS.map((o) => ({
        id: o.value,
        name: o.label,
        checked: false,
      })),
    },
  ];

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Crea', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    legalName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    legalForm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    contactEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    /**
     * Chi la possiede, non chi la digita. Obbligatorio: il Super Admin apre le
     * organizzazioni per conto di altri, e ometterlo lo renderebbe proprietario
     * di ogni cliente della piattaforma — il backend infatti rifiuta.
     */
    ownerUserId: new FormControl<number | null>(null, { validators: [Validators.required] }),
  });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((value) => void this.store.setQuery({ value: value || undefined }));
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Organizzazione');
    this.registerActions();
    await this.store.replaceQuery({});
    await Promise.all([this.loadPublishedCounts(), this.loadUsers()]);
  }

  /**
   * L'elenco da cui si designa il titolare. Stessa lettura della pagina membri
   * (`/organization/members`), che risolve lo stesso problema per i ruoli
   * interni all'organizzazione.
   */
  private async loadUsers(): Promise<void> {
    const page = await this.api.list<UserRow>('users', {}, { page: 1, limit: 200 });
    this.userOptions.set((page.docs ?? []).map((u) => ({ label: u.username, value: u.id })));
  }

  /** Il nome del titolare per il messaggio di conferma, non un'altra chiamata. */
  private ownerName(userId: number | null): string {
    const found = this.userOptions().find((o) => o.value === userId);
    return found ? found.label : 'Il titolare indicato';
  }

  private registerActions(): void {
    this.pageActions.set([
      {
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea un’organizzazione',
        run: () => this.startCreate(),
      } as PageAction,
    ]);
  }

  private async loadPublishedCounts(): Promise<void> {
    const orgs = this.store.items();
    if (!orgs.length) {
      this.published.set({});
      return;
    }
    const entries = await Promise.all(
      orgs.map(async (org) => {
        try {
          const docs = await this.events.loadAll(
            { organizationId: org.id, status: ['PUBLISHED', 'SALES_CLOSED', 'RUNNING'] },
            200,
            '',
          );
          return [org.id, docs.length] as const;
        } catch {
          return [org.id, 0] as const;
        }
      }),
    );
    this.published.set(Object.fromEntries(entries));
  }

  publishedCount(id: number): number | null {
    const value = this.published()[id];
    return value === undefined ? null : value;
  }

  onFilterChanged(change: KeijoFilterChange): void {
    if (change.field !== 'status') return;
    const ids = Array.isArray(change.value) ? (change.value as OrganizationStatus[]) : [];
    void this.store.setQuery({ status: ids.length ? ids : undefined });
  }

  onPage(page: number): void {
    void this.store.setPage(page).then(() => this.loadPublishedCounts());
  }
  onPageSize(size: number): void {
    void this.store.setPageSize(size).then(() => this.loadPublishedCounts());
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  statusUi(status: OrganizationStatus) {
    return ORGANIZATION_STATUS_UI[status];
  }
  payoutUi(status: PayoutStatus) {
    return PAYOUT_STATUS_UI[status];
  }

  open(org: Organization): void {
    // La riga scelta viaggia nell'URL. Il solo `loadOne` non bastava: l'`ngOnInit`
    // della scheda organizzazione ricaricava `items()[0]` e sovrascriveva la
    // selezione, così si apriva sempre la prima organizzazione dell'elenco.
    // (keijo-fe-check, 4 agosto 2026, rilievo A2.)
    void this.router.navigate(['/organization'], { queryParams: { orgId: org.id } });
  }

  startCreate(): void {
    this.form.reset({ name: '', legalName: '', legalForm: '', contactEmail: '' });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  async onEditAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.editing.set(false);
      return;
    }
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);
    if (this.form.invalid) {
      this.formErrors.set([
        'Denominazione, ragione sociale, forma giuridica, email e titolare sono obbligatori.',
      ]);
      return;
    }

    const value = this.form.getRawValue();
    try {
      await this.store.create({
        name: value.name.trim(),
        legalName: value.legalName.trim(),
        legalForm: value.legalForm.trim(),
        contactEmail: value.contactEmail.trim(),
        ownerUserId: Number(value.ownerUserId),
      });
      this.editing.set(false);
      this.toast.show(
        'SUCCESS',
        `Organizzazione creata. ${this.ownerName(value.ownerUserId)} ne è titolare e può amministrarla.`,
      );
      await this.store.load();
      await this.loadPublishedCounts();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async setStatus(org: Organization, status: OrganizationStatus): Promise<void> {
    if (status === 'SUSPENDED') {
      const ok = await this.confirm.ask({
        title: 'Sospendere l’organizzazione?',
        message:
          `«${org.name}» non potrà più pubblicare eventi né vendere online. I biglietti già ` +
          'emessi restano validi e i rimborsi restano eseguibili: la sospensione riguarda la ' +
          'vendita, non gli impegni già presi.',
        confirmLabel: 'Sospendi',
        destructive: true,
      });
      if (!ok) return;
    }
    await this.store.update(org.id, { status });
    this.toast.show(
      'SUCCESS',
      status === 'SUSPENDED' ? 'Organizzazione sospesa.' : 'Organizzazione riattivata.',
    );
  }
}
