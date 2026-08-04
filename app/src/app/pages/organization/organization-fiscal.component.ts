import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  EntityListItemComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
  TextareaComponent,
} from '@keijo/ui';
import { add, check, close, description, lock, numbers, person } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import {
  FISCAL_DECLARATION_KIND_OPTIONS,
  FISCAL_DECLARATION_KIND_UI,
  FiscalDeclarationKind,
} from '../../core/domain/enums';
import { FiscalDeclaration } from '../../core/domain/models';
import { formatDateTime } from '../../core/i18n/format';
import { LocaleService, i18nPlain } from '../../core/i18n/i18n-text';
import { EventStore } from '../../stores/event.store';
import { FiscalDeclarationStore } from '../../stores/fiscal-declaration.store';
import { OrganizationStore } from '../../stores/organization.store';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { OrganizationContextComponent } from './organization-context.component';

/**
 * `/organization/fiscal` — le **dichiarazioni di inquadramento** (§4.9).
 *
 * La `FiscalDeclaration` è **immutabile** (`RF-ORG-8`): non esiste modifica né
 * eliminazione, si crea una nuova versione. L'interfaccia non offre nemmeno
 * l'azione: mostrarla disabilitata sarebbe suggerire che esista.
 */
@Component({
  selector: 'app-organization-fiscal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ListItemsWrapperComponent,
    ListItemsSkeletonComponent,
    EntityListItemComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    TextareaComponent,
    SelectComponent,
    StatusPillComponent,
    OrganizationContextComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-organization-context current="fiscal" />

      @if (editing()) {
        <keijo-page-section-wrapper
          title="Nuova dichiarazione"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          <p class="mirada-hint">
            Le dichiarazioni non si modificano: se cambia l’inquadramento, si registra una nuova
            versione. La data, l’autore e l’indirizzo di provenienza vengono registrati dal
            sistema.
          </p>
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-select
                [formControl]="form.controls.kind"
                [data]="kindOptions"
                label="tipo di dichiarazione"
                placeholder="Inquadramento o attestazione di evento"
              />
              @if (form.controls.kind.value === 'EVENT_ATTESTATION') {
                <keijo-select
                  [formControl]="form.controls.eventId"
                  [data]="eventOptions()"
                  label="evento"
                  placeholder="Evento a cui si riferisce"
                />
              }
            </keijo-form-row>

            <keijo-form-row [cols]="1">
              <keijo-input
                [formControl]="form.controls.frameworkLabel"
                label="inquadramento dichiarato"
                id="frameworkLabel"
                type="text"
              />
            </keijo-form-row>
            @if (err('frameworkLabel'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.statementText"
                label="testo della dichiarazione"
                id="statementText"
                [rows]="5"
              />
            </keijo-form-row>
            @if (err('statementText'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (row of store.items(); track row.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title">{{ row.frameworkLabel }}</span>
                    <span class="mirada-muted">{{ when(row.declaredAt) }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="kindUi(row.kind)" />
                    <keijo-pill variant="default" [icon]="versionIcon">
                      versione {{ row.version }}
                    </keijo-pill>
                    <keijo-pill variant="default" [icon]="authorIcon">
                      {{ row.declaredBy?.username ?? 'utente #' + row.declaredByUserId }}
                    </keijo-pill>
                    @if (row.event) {
                      <keijo-pill variant="default" [icon]="declarationIcon">
                        {{ eventTitle(row) }}
                      </keijo-pill>
                    }
                    <keijo-pill
                      variant="info"
                      [icon]="immutableIcon"
                      tooltip="Le dichiarazioni non si modificano: si crea una nuova versione"
                    >
                      immutabile
                    </keijo-pill>
                  </div>
                  <p class="statement">{{ row.statementText }}</p>
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box
                [icon]="declarationIcon"
                title="Nessuna dichiarazione registrata"
                variant="info"
              >
                <span>
                  La dichiarazione di inquadramento descrive come l’organizzazione tratta gli
                  incassi. La piattaforma è uno strumento di vendita, non un intermediario
                  fiscale: gli adempimenti restano dell’organizzatore.
                </span>
              </keijo-info-box>
            }
          </keijo-list-items-wrapper>
        }
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>
  `,
  styles: [
    `
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
      .statement {
        margin: 0.5rem 0 0;
        font-size: 0.8125rem;
        line-height: 1.5;
        white-space: pre-wrap;
      }
    `,
  ],
})
export class OrganizationFiscalComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly locale = inject(LocaleService);
  private readonly organizations = inject(OrganizationStore);
  private readonly events = inject(EventStore);

  readonly store = inject(FiscalDeclarationStore);

  readonly declarationIcon = description;
  readonly versionIcon = numbers;
  readonly authorIcon = person;
  readonly immutableIcon = lock;

  readonly editing = signal(false);
  readonly formErrors = signal<string[]>([]);
  readonly eventOptions = signal<SelectOption[]>([]);

  readonly kindOptions: SelectOption[] = FISCAL_DECLARATION_KIND_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Registra', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    kind: new FormControl<FiscalDeclarationKind>('ORGANIZATION_FRAMEWORK', { nonNullable: true }),
    eventId: new FormControl<number | null>(null),
    frameworkLabel: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    statementText: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly organizationId = computed(() => this.organizations.current()?.id ?? null);

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Dichiarazione');
    await this.organizations.replaceQuery({});
    // Conserva la selezione già attiva: ricaricare incondizionatamente
    // `items()[0]` la sovrascriveva a ogni navigazione fra le schede
    // dell'organizzazione. (keijo-fe-check, 4 agosto 2026, rilievo A2.)
    const target = this.organizations.current()?.id ?? this.organizations.items()[0]?.id;
    if (target) await this.organizations.loadOne(target);

    const orgId = this.organizationId();
    await Promise.all([
      this.store.replaceQuery(orgId ? { organizationId: orgId } : {}),
      this.loadEvents(),
    ]);
    this.registerActions();
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.organizationId()) {
      actions.push({
        id: 'create',
        icon: add,
        label: 'Nuova',
        tooltip: 'Registra una nuova dichiarazione',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  private async loadEvents(): Promise<void> {
    const lang = this.locale.lang();
    const docs = await this.events.loadAll({}, 100, '');
    this.eventOptions.set(docs.map((e) => ({ label: i18nPlain(e.title, lang), value: e.id })));
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  when(value: string | null | undefined): string {
    return formatDateTime(value);
  }

  kindUi(kind: FiscalDeclarationKind) {
    return FISCAL_DECLARATION_KIND_UI[kind];
  }

  eventTitle(row: FiscalDeclaration): string {
    return i18nPlain(row.event?.title, this.locale.lang(), `evento #${row.eventId}`);
  }

  startCreate(): void {
    this.form.reset({
      kind: 'ORGANIZATION_FRAMEWORK',
      eventId: null,
      frameworkLabel: '',
      statementText: '',
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  async onEditAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.editing.set(false);
      return;
    }
    const orgId = this.organizationId();
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);
    if (!orgId || this.form.invalid) {
      this.formErrors.set(['Inquadramento e testo della dichiarazione sono obbligatori.']);
      return;
    }

    const value = this.form.getRawValue();
    try {
      await this.store.create({
        organizationId: orgId,
        eventId: value.kind === 'EVENT_ATTESTATION' && value.eventId ? Number(value.eventId) : null,
        kind: value.kind,
        frameworkLabel: value.frameworkLabel.trim(),
        statementText: value.statementText.trim(),
      });
      this.editing.set(false);
      this.toast.show('SUCCESS', 'Dichiarazione registrata.');
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }
}
