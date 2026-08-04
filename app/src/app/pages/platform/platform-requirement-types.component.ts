import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonComponent,
  CheckboxComponent,
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
import { add, check, checklist, close, edit, iconDelete, toggleOff, toggleOn } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import {
  REQUIREMENT_KIND_OPTIONS,
  REQUIREMENT_KIND_UI,
  RequirementKind,
} from '../../core/domain/enums';
import { RequirementType } from '../../core/domain/models';
import { LocaleService, buildI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { RequirementTypeStore } from '../../stores/requirement-type.store';
import { ConfirmService } from '../../shared/confirm.service';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { StatusPillComponent } from '../../shared/status-pill.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';

/**
 * `/platform/requirement-types` — catalogo dei tipi di requisito (§4.10, `GOD`).
 *
 * Nel primo taglio esistono solo **dichiarazioni** e **campi personalizzati**:
 * nessun caricamento di documenti, nessun dato sanitario.
 */
@Component({
  selector: 'app-platform-requirement-types',
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
    I18nTextComponent,
    StatusPillComponent,
  ],
  template: `
    <keijo-page-wrapper>
      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica tipo requisito' : 'Nuovo tipo requisito'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="3">
              <keijo-input
                [formControl]="form.controls.nameIt"
                label="nome (italiano)"
                id="rtNameIt"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.nameEn"
                label="nome (inglese)"
                id="rtNameEn"
                type="text"
              />
              <keijo-select
                [formControl]="form.controls.kind"
                [data]="kindOptions"
                label="genere"
                placeholder="Dichiarazione o campo personalizzato"
              />
            </keijo-form-row>
            @if (err('nameIt'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.configSchema"
                label="schema di configurazione (JSON)"
                id="rtConfigSchema"
                [rows]="4"
              />
            </keijo-form-row>
            @if (schemaError(); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            <p class="mirada-hint">
              Lo schema descrive che cosa l’organizzatore potrà configurare quando aggiunge questo
              requisito a un evento. Lasciato vuoto vale l’oggetto vuoto.
            </p>

            <keijo-form-row [cols]="1">
              <keijo-checkbox [formControl]="form.controls.active" label="Attivo nel catalogo" />
            </keijo-form-row>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (type of store.items(); track type.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <span class="title"><app-i18n-text [value]="type.name" /></span>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <app-status-pill [status]="kindUi(type.kind)" />
                    @if (type.active) {
                      <keijo-pill variant="success" [icon]="activeIcon">attivo</keijo-pill>
                    } @else {
                      <keijo-pill variant="default" [icon]="inactiveIcon">disattivato</keijo-pill>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  <keijo-button
                    variant="error"
                    [icon]="deleteIcon"
                    tooltip="Elimina il tipo requisito"
                    (action)="remove(type)"
                  />
                  <keijo-button
                    variant="warning"
                    [icon]="editIcon"
                    tooltip="Modifica il tipo requisito"
                    (action)="startEdit(type)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="requirementIcon" title="Catalogo vuoto" variant="info">
                <span>
                  I tipi di requisito sono estensibili a runtime: aggiungerne uno non richiede un
                  rilascio, ed è il principio che regge l’intera analisi.
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
export class PlatformRequirementTypesComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly locale = inject(LocaleService);

  readonly store = inject(RequirementTypeStore);

  readonly requirementIcon = checklist;
  readonly activeIcon = toggleOn;
  readonly inactiveIcon = toggleOff;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly schemaError = signal<string | null>(null);

  readonly kindOptions: SelectOption[] = REQUIREMENT_KIND_OPTIONS.map((o) => ({
    label: o.label,
    value: o.value,
  }));

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    nameIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nameEn: new FormControl('', { nonNullable: true }),
    kind: new FormControl<RequirementKind>('DECLARATION', { nonNullable: true }),
    configSchema: new FormControl('', { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Tipo requisito');
    this.registerActions();
    await this.store.replaceQuery({});
  }

  private registerActions(): void {
    this.pageActions.set([
      {
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea un tipo requisito',
        run: () => this.startCreate(),
      } as PageAction,
    ]);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  kindUi(kind: RequirementKind) {
    return REQUIREMENT_KIND_UI[kind];
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      nameIt: '',
      nameEn: '',
      kind: 'DECLARATION',
      configSchema: '',
      active: true,
    });
    this.formErrors.set([]);
    this.schemaError.set(null);
    this.editing.set(true);
  }

  startEdit(type: RequirementType): void {
    this.editingId.set(type.id);
    this.form.reset({
      nameIt: type.name?.it ?? '',
      nameEn: type.name?.en ?? '',
      kind: type.kind,
      configSchema: type.configSchema ? JSON.stringify(type.configSchema, null, 2) : '',
      active: type.active,
    });
    this.formErrors.set([]);
    this.schemaError.set(null);
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
    this.schemaError.set(null);
    if (this.form.invalid) {
      this.formErrors.set(['Il nome del tipo requisito è obbligatorio.']);
      return;
    }

    const value = this.form.getRawValue();
    let configSchema: unknown = {};
    if (value.configSchema.trim()) {
      try {
        configSchema = JSON.parse(value.configSchema);
      } catch {
        this.schemaError.set('Lo schema di configurazione non è JSON valido.');
        return;
      }
    }

    try {
      const payload = {
        name: buildI18n(value.nameIt, value.nameEn),
        kind: value.kind,
        configSchema,
        active: value.active,
      };
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Tipo requisito creato.');
      } else {
        await this.store.update(id, payload);
        this.toast.show('SUCCESS', 'Tipo requisito aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(type: RequirementType): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare il tipo requisito?',
      message:
        `«${i18nPlain(type.name, this.locale.lang())}» non sarà più scegliibile sugli eventi. ` +
        'I requisiti già configurati con questo tipo restano dove sono.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(type.id);
    this.toast.show('SUCCESS', 'Tipo requisito eliminato.');
  }
}
