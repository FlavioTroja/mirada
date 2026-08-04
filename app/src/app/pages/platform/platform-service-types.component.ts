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
  TextareaComponent,
} from '@keijo/ui';
import { add, check, close, edit, iconDelete, restaurant, toggleOff, toggleOn } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { ServiceType } from '../../core/domain/models';
import { LocaleService, buildI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { ServiceTypeStore } from '../../stores/service-type.store';
import { ConfirmService } from '../../shared/confirm.service';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';

/**
 * `/platform/service-types` — catalogo dei tipi di servizio accessorio
 * (§4.10, `GOD`).
 *
 * Lo schema degli attributi dichiara che cosa si raccoglie all'acquisto: taglia,
 * dieta, slot. **Diete e allergie** sono l'unico dato riconducibile alla salute
 * che resta in piattaforma: accesso ristretto, mai nelle esportazioni generiche.
 */
@Component({
  selector: 'app-platform-service-types',
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
    CheckboxComponent,
    I18nTextComponent,
  ],
  template: `
    <keijo-page-wrapper>
      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica tipo servizio' : 'Nuovo tipo servizio'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.nameIt"
                label="nome (italiano)"
                id="stNameIt"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.nameEn"
                label="nome (inglese)"
                id="stNameEn"
                type="text"
              />
            </keijo-form-row>
            @if (err('nameIt'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.attributesSchema"
                label="schema degli attributi raccolti (JSON)"
                id="stAttributes"
                [rows]="4"
              />
            </keijo-form-row>
            @if (schemaError(); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            <p class="mirada-hint">
              Se lo schema raccoglie diete o allergie, quei dati compaiono solo nelle liste
              operative con accesso ristretto: mai nelle esportazioni generiche, mai nella vista
              di check-in.
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
                    tooltip="Elimina il tipo servizio"
                    (action)="remove(type)"
                  />
                  <keijo-button
                    variant="warning"
                    [icon]="editIcon"
                    tooltip="Modifica il tipo servizio"
                    (action)="startEdit(type)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="serviceIcon" title="Catalogo vuoto" variant="info">
                <span>
                  Cene, pernottamenti, transfer e gadget si modellano come tipi di servizio, e
                  ogni evento poi ne compone i propri con prezzi e cut-off.
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
export class PlatformServiceTypesComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly locale = inject(LocaleService);

  readonly store = inject(ServiceTypeStore);

  readonly serviceIcon = restaurant;
  readonly activeIcon = toggleOn;
  readonly inactiveIcon = toggleOff;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly schemaError = signal<string | null>(null);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    nameIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nameEn: new FormControl('', { nonNullable: true }),
    attributesSchema: new FormControl('', { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Tipo servizio');
    this.registerActions();
    await this.store.replaceQuery({});
  }

  private registerActions(): void {
    this.pageActions.set([
      {
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea un tipo servizio',
        run: () => this.startCreate(),
      } as PageAction,
    ]);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({ nameIt: '', nameEn: '', attributesSchema: '', active: true });
    this.formErrors.set([]);
    this.schemaError.set(null);
    this.editing.set(true);
  }

  startEdit(type: ServiceType): void {
    this.editingId.set(type.id);
    this.form.reset({
      nameIt: type.name?.it ?? '',
      nameEn: type.name?.en ?? '',
      attributesSchema: type.attributesSchema
        ? JSON.stringify(type.attributesSchema, null, 2)
        : '',
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
      this.formErrors.set(['Il nome del tipo servizio è obbligatorio.']);
      return;
    }

    const value = this.form.getRawValue();
    let attributesSchema: unknown = {};
    if (value.attributesSchema.trim()) {
      try {
        attributesSchema = JSON.parse(value.attributesSchema);
      } catch {
        this.schemaError.set('Lo schema degli attributi non è JSON valido.');
        return;
      }
    }

    try {
      const payload = {
        name: buildI18n(value.nameIt, value.nameEn),
        attributesSchema,
        active: value.active,
      };
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Tipo servizio creato.');
      } else {
        await this.store.update(id, payload);
        this.toast.show('SUCCESS', 'Tipo servizio aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(type: ServiceType): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare il tipo servizio?',
      message:
        `«${i18nPlain(type.name, this.locale.lang())}» non sarà più scegliibile sugli eventi. ` +
        'I servizi già configurati restano dove sono.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(type.id);
    this.toast.show('SUCCESS', 'Tipo servizio eliminato.');
  }
}
