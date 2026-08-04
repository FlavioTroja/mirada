import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonComponent,
  CheckboxComponent,
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
import { add, check, checklist, close, edit, iconDelete, schedule } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  REQUIREMENT_BLOCKING_OPTIONS,
  REQUIREMENT_BLOCKING_UI,
  REQUIREMENT_VERIFICATION_OPTIONS,
  REQUIREMENT_VERIFICATION_UI,
  RequirementBlocking,
  RequirementVerification,
} from '../../core/domain/enums';
import { EventRequirement } from '../../core/domain/models';
import { formatDateTime, toIso } from '../../core/i18n/format';
import { LocaleService, buildI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { EventRequirementStore } from '../../stores/event-requirement.store';
import { EventStore } from '../../stores/event.store';
import { RequirementTypeStore } from '../../stores/requirement-type.store';
import { ConfirmService } from '../../shared/confirm.service';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { EventWorkspaceNavComponent } from './event-workspace-nav.component';

/**
 * `/events/:id/requirements` — i requisiti di partecipazione (§4.2).
 *
 * Il `kind` del requisito è ereditato dal `RequirementType` del catalogo di
 * piattaforma, non ridichiarato qui. Nel primo taglio esistono solo
 * dichiarazioni e campi personalizzati: nessun caricamento di documenti,
 * nessun dato sanitario.
 */
@Component({
  selector: 'app-event-requirements',
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
    CheckboxComponent,
    DateTimePickerComponent,
    I18nTextComponent,
    StatusPillComponent,
    EventWorkspaceNavComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-event-workspace-nav [event]="eventStore.current()" current="requirements" />

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica requisito' : 'Nuovo requisito'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-select
                [formControl]="form.controls.requirementTypeId"
                [data]="typeOptions()"
                label="tipo di requisito"
                placeholder="Scegli dal catalogo di piattaforma"
              />
              <keijo-input
                [formControl]="form.controls.labelIt"
                label="etichetta (italiano)"
                id="reqLabelIt"
                type="text"
              />
            </keijo-form-row>
            @if (err('requirementTypeId'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            @if (err('labelIt'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.textIt"
                label="testo mostrato al partecipante (italiano)"
                id="reqTextIt"
                [rows]="3"
              />
            </keijo-form-row>
            @if (err('textIt'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.textEn"
                label="testo mostrato al partecipante (inglese)"
                id="reqTextEn"
                [rows]="3"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="3">
              <keijo-select
                [formControl]="form.controls.blocking"
                [data]="blockingOptions"
                label="quando blocca"
                placeholder="Non blocca"
              />
              <keijo-select
                [formControl]="form.controls.verification"
                [data]="verificationOptions"
                label="verifica"
                placeholder="Automatica o manuale"
              />
              <keijo-datetime-picker
                [formControl]="form.controls.dueAt"
                label="scadenza"
                id="reqDueAt"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="1">
              <keijo-checkbox
                [formControl]="form.controls.mandatory"
                label="Requisito obbligatorio per tutti gli iscritti"
              />
            </keijo-form-row>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (req of store.items(); track req.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title"><app-i18n-text [value]="req.label" /></span>
                    <span class="mirada-muted"><app-i18n-text [value]="req.text" /></span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="blockingUi(req.blocking)" />
                    <app-status-pill [status]="verificationUi(req.verification)" />
                    @if (req.mandatory) {
                      <keijo-pill variant="warning" [icon]="requirementIcon">obbligatorio</keijo-pill>
                    }
                    @if (req.dueAt) {
                      <keijo-pill variant="default" [icon]="dueIcon">
                        entro il {{ due(req) }}
                      </keijo-pill>
                    }
                    @if (req.requirementType) {
                      <keijo-pill variant="default" [icon]="requirementIcon">
                        <app-i18n-text [value]="req.requirementType.name" />
                      </keijo-pill>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Elimina il requisito"
                      (action)="remove(req)"
                    />
                    <keijo-button
                      variant="warning"
                      [icon]="editIcon"
                      tooltip="Modifica il requisito"
                      (action)="startEdit(req)"
                    />
                  }
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="requirementIcon" title="Nessun requisito" variant="info">
                <span>
                  I requisiti sono ciò che il partecipante deve dichiarare o fornire: adesione al
                  regolamento, tessera associativa, taglia della maglietta. Ognuno dichiara se
                  blocca l’acquisto, l’ingresso, o nessuno dei due.
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
export class EventRequirementsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly locale = inject(LocaleService);
  private readonly types = inject(RequirementTypeStore);

  readonly store = inject(EventRequirementStore);
  readonly eventStore = inject(EventStore);

  readonly requirementIcon = checklist;
  readonly dueIcon = schedule;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  private readonly eventId = signal(0);
  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly typeOptions = signal<SelectOption[]>([]);

  readonly blockingOptions: SelectOption[] = REQUIREMENT_BLOCKING_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));
  readonly verificationOptions: SelectOption[] = REQUIREMENT_VERIFICATION_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));

  readonly canWrite = computed(() => this.auth.can().eventsWrite);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    requirementTypeId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    labelIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    labelEn: new FormControl('', { nonNullable: true }),
    textIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    textEn: new FormControl('', { nonNullable: true }),
    mandatory: new FormControl(false, { nonNullable: true }),
    blocking: new FormControl<RequirementBlocking>('NONE', { nonNullable: true }),
    verification: new FormControl<RequirementVerification>('AUTOMATIC', { nonNullable: true }),
    dueAt: new FormControl<Date | null>(null),
  });

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Requisito');
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
        tooltip: 'Aggiungi un requisito',
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

  blockingUi(blocking: RequirementBlocking) {
    return REQUIREMENT_BLOCKING_UI[blocking];
  }
  verificationUi(verification: RequirementVerification) {
    return REQUIREMENT_VERIFICATION_UI[verification];
  }
  due(req: EventRequirement): string {
    return formatDateTime(req.dueAt);
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      labelIt: '',
      labelEn: '',
      textIt: '',
      textEn: '',
      mandatory: false,
      blocking: 'NONE',
      verification: 'AUTOMATIC',
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(req: EventRequirement): void {
    this.editingId.set(req.id);
    this.form.reset({
      requirementTypeId: req.requirementTypeId,
      labelIt: req.label?.it ?? '',
      labelEn: req.label?.en ?? '',
      textIt: req.text?.it ?? '',
      textEn: req.text?.en ?? '',
      mandatory: req.mandatory,
      blocking: req.blocking,
      verification: req.verification,
      dueAt: req.dueAt ? new Date(req.dueAt) : null,
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
      this.formErrors.set(['Tipo, etichetta e testo del requisito sono obbligatori.']);
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      eventId: this.eventId(),
      requirementTypeId: Number(value.requirementTypeId),
      label: buildI18n(value.labelIt, value.labelEn),
      text: buildI18n(value.textIt, value.textEn),
      mandatory: value.mandatory,
      blocking: value.blocking,
      verification: value.verification,
      dueAt: toIso(value.dueAt),
      sortOrder: this.editingId() === null ? this.store.items().length : undefined,
    };

    try {
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Requisito aggiunto.');
      } else {
        const { eventId: _e, sortOrder: _s, ...patch } = payload;
        await this.store.update(id, patch);
        this.toast.show('SUCCESS', 'Requisito aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(req: EventRequirement): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare il requisito?',
      message:
        `«${i18nPlain(req.label, this.locale.lang())}» non verrà più chiesto ai nuovi iscritti. ` +
        'Gli esiti già raccolti restano collegati alle iscrizioni esistenti.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(req.id);
    this.toast.show('SUCCESS', 'Requisito eliminato.');
  }
}
