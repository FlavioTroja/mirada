import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonComponent,
  DateTimePickerComponent,
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
import { add, check, close, edit, iconDelete, restaurant, schedule } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { EventService } from '../../core/domain/models';
import {
  centsToEuroInput,
  euroInputToCents,
  formatCents,
  formatDateTime,
  toIso,
} from '../../core/i18n/format';
import { LocaleService, buildI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { EventServiceStore } from '../../stores/event-service.store';
import { EventStore } from '../../stores/event.store';
import { ServiceTypeStore } from '../../stores/service-type.store';
import { ConfirmService } from '../../shared/confirm.service';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { EventWorkspaceNavComponent } from './event-workspace-nav.component';

/**
 * `/events/:id/services` — i servizi accessori dell'evento (§4.2).
 *
 * Il prezzo è in **centesimi interi**. Gli attributi raccolti all'acquisto
 * (taglia, dieta, slot) sono dichiarati dal `ServiceType` del catalogo:
 * **diete e allergie compaiono solo nelle liste operative**, mai nelle
 * esportazioni generiche né nella vista di check-in.
 */
@Component({
  selector: 'app-event-services',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ListItemsWrapperComponent,
    ListItemsSkeletonComponent,
    EntityListItemComponent,
    ButtonComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    TextareaComponent,
    SelectComponent,
    DateTimePickerComponent,
    I18nTextComponent,
    EventWorkspaceNavComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-event-workspace-nav [event]="eventStore.current()" current="services" />

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica servizio' : 'Nuovo servizio'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-select
                [formControl]="form.controls.serviceTypeId"
                [data]="typeOptions()"
                label="tipo di servizio"
                placeholder="Scegli dal catalogo di piattaforma"
              />
              <keijo-input
                [formControl]="form.controls.nameIt"
                label="nome (italiano)"
                id="svcNameIt"
                type="text"
              />
            </keijo-form-row>
            @if (err('serviceTypeId'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            @if (err('nameIt'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.descriptionIt"
                label="descrizione (italiano)"
                id="svcDescIt"
                [rows]="3"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.price"
                label="prezzo"
                id="svcPrice"
                type="number"
                step="0.01"
                min="0"
                unitMeasure="€"
              />
              <keijo-datetime-picker
                [formControl]="form.controls.refundCutoffAt"
                label="cut-off di rimborso"
                id="refundCutoffAt"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              Oltre il cut-off il servizio non è più rimborsabile: è la data entro cui
              l’organizzatore deve confermare i numeri al fornitore.
            </p>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (service of store.items(); track service.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title"><app-i18n-text [value]="service.name" /></span>
                    <span class="mirada-muted">{{ price(service) }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    @if (service.serviceType) {
                      <keijo-pill variant="default" [icon]="serviceIcon">
                        <app-i18n-text [value]="service.serviceType.name" />
                      </keijo-pill>
                    }
                    @if (service.refundCutoffAt) {
                      <keijo-pill variant="warning" [icon]="cutoffIcon">
                        rimborsabile fino al {{ cutoff(service) }}
                      </keijo-pill>
                    }
                    @if (service.description) {
                      <span class="mirada-muted"><app-i18n-text [value]="service.description" /></span>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Elimina il servizio"
                      (action)="remove(service)"
                    />
                    <keijo-button
                      variant="warning"
                      [icon]="editIcon"
                      tooltip="Modifica il servizio"
                      (action)="startEdit(service)"
                    />
                  }
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="serviceIcon" title="Nessun servizio accessorio" variant="info">
                <span>
                  Cene, pernottamenti, transfer e gadget si vendono come servizi accessori
                  dell’evento, con le loro quote di capienza e il loro cut-off di rimborso.
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
    `,
  ],
})
export class EventServicesComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly types = inject(ServiceTypeStore);

  readonly store = inject(EventServiceStore);
  readonly eventStore = inject(EventStore);

  readonly serviceIcon = restaurant;
  readonly cutoffIcon = schedule;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  private readonly eventId = signal(0);
  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly typeOptions = signal<SelectOption[]>([]);

  readonly canWrite = computed(() => this.auth.can().eventsWrite);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    serviceTypeId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    nameIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nameEn: new FormControl('', { nonNullable: true }),
    descriptionIt: new FormControl('', { nonNullable: true }),
    price: new FormControl<string>('0', { nonNullable: true }),
    refundCutoffAt: new FormControl<Date | null>(null),
  });

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Servizio');
    this.eventId.set(Number(this.route.snapshot.paramMap.get('id')));
    this.registerActions();
    await Promise.all([
      this.eventStore.loadOne(this.eventId()),
      this.store.replaceQuery({ eventId: this.eventId() }),
      this.loadTypes(),
    ]);
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite()) {
      actions.push({
        id: 'create',
        icon: add,
        label: 'Aggiungi',
        tooltip: 'Aggiungi un servizio accessorio',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  private async loadTypes(): Promise<void> {
    const lang = this.locale.lang();
    const docs = await this.types.loadAll({ active: true }, 100, '');
    this.typeOptions.set(docs.map((t) => ({ label: i18nPlain(t.name, lang), value: t.id })));
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  price(service: EventService): string {
    return formatCents(service.price);
  }

  cutoff(service: EventService): string {
    return formatDateTime(service.refundCutoffAt);
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({ nameIt: '', nameEn: '', descriptionIt: '', price: '0' });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(service: EventService): void {
    this.editingId.set(service.id);
    this.form.reset({
      serviceTypeId: service.serviceTypeId,
      nameIt: service.name?.it ?? '',
      nameEn: service.name?.en ?? '',
      descriptionIt: service.description?.it ?? '',
      price: centsToEuroInput(service.price),
      refundCutoffAt: service.refundCutoffAt ? new Date(service.refundCutoffAt) : null,
    });
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
      this.formErrors.set(['Tipo di servizio e nome sono obbligatori.']);
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      eventId: this.eventId(),
      serviceTypeId: Number(value.serviceTypeId),
      name: buildI18n(value.nameIt, value.nameEn),
      description: value.descriptionIt.trim() ? buildI18n(value.descriptionIt) : null,
      price: euroInputToCents(value.price),
      refundCutoffAt: toIso(value.refundCutoffAt),
      sortOrder: this.editingId() === null ? this.store.items().length : undefined,
    };

    try {
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Servizio aggiunto.');
      } else {
        const { eventId: _e, sortOrder: _s, ...patch } = payload;
        await this.store.update(id, patch);
        this.toast.show('SUCCESS', 'Servizio aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(service: EventService): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare il servizio?',
      message:
        `«${i18nPlain(service.name, this.locale.lang())}» non sarà più acquistabile. ` +
        'I servizi già acquistati restano collegati agli ordini esistenti.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(service.id);
    this.toast.show('SUCCESS', 'Servizio eliminato.');
  }
}
