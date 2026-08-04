import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonComponent,
  CheckboxComponent,
  KeijoIconShape,
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
} from '@keijo/ui';
import {
  add,
  check,
  checklist,
  close,
  description,
  edit,
  eventSeat,
  handshake,
  iconDelete,
  nightlife,
  restaurant,
  scale,
  sell,
  star,
  theaters,
  toggleOff,
  toggleOn,
  warning,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { EventType } from '../../core/domain/models';
import { LocaleService, buildI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { EventTypeStore } from '../../stores/event-type.store';
import { ConfirmService } from '../../shared/confirm.service';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';

/**
 * `/platform/event-types` — il catalogo dei tipi di evento (§4.10, solo `GOD`).
 *
 * Creare o modificare un `EventType` significa **cambiare il wizard** che gli
 * organizzatori incontrano: le cinque capacità decidono quali schede del
 * workspace compaiono. L'editor lo dichiara e mostra l'anteprima delle sezioni
 * attivate, invece di lasciarlo scoprire dopo.
 */
@Component({
  selector: 'app-platform-event-types',
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
    CheckboxComponent,
    I18nTextComponent,
  ],
  template: `
    <keijo-page-wrapper>
      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica tipo evento' : 'Nuovo tipo evento'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          <keijo-info-box
            [icon]="warningIcon"
            title="Questo editor cambia il wizard degli organizzatori"
            variant="warning"
          >
            <span>
              Le cinque capacità decidono quali schede del workspace evento compaiono. Con
              l’impostazione attuale un evento di questo tipo mostrerà:
              <strong>{{ previewSections().join(' · ') }}</strong>.
            </span>
          </keijo-info-box>

          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="3">
              <keijo-input
                [formControl]="form.controls.nameIt"
                label="nome (italiano)"
                id="etNameIt"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.nameEn"
                label="nome (inglese)"
                id="etNameEn"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.slug"
                label="slug"
                id="etSlug"
                type="text"
              />
            </keijo-form-row>
            @if (err('nameIt'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            @if (err('slug'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="3">
              <keijo-checkbox
                [formControl]="form.controls.capMultiSession"
                label="Sessioni multiple (workshop, milonghe, spettacoli distinti)"
              />
              <keijo-checkbox
                [formControl]="form.controls.capRoleQuotas"
                label="Quote per ruolo (leader / follower)"
              />
              <keijo-checkbox
                [formControl]="form.controls.capLevels"
                label="Livelli indicati sulle sessioni"
              />
            </keijo-form-row>
            <keijo-form-row [cols]="3">
              <keijo-checkbox [formControl]="form.controls.capCast" label="Cast di artisti" />
              <keijo-checkbox
                [formControl]="form.controls.capCouple"
                label="Iscrizione a coppia"
              />
              <keijo-checkbox [formControl]="form.controls.active" label="Attivo nel catalogo" />
            </keijo-form-row>

            <keijo-form-row [cols]="1">
              <keijo-input
                [formControl]="form.controls.sortOrder"
                label="ordine nel catalogo"
                id="etSortOrder"
                type="number"
                min="0"
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
            @for (type of store.items(); track type.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title"><app-i18n-text [value]="type.name" /></span>
                    <span class="mirada-muted">{{ type.slug }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    @if (type.active) {
                      <keijo-pill variant="success" [icon]="activeIcon">attivo</keijo-pill>
                    } @else {
                      <keijo-pill variant="default" [icon]="inactiveIcon">disattivato</keijo-pill>
                    }
                    @for (section of sectionsOf(type); track section) {
                      <keijo-pill variant="default" [icon]="sectionIcon(section)">{{
                        section
                      }}</keijo-pill>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  <keijo-button
                    variant="error"
                    [icon]="deleteIcon"
                    tooltip="Elimina il tipo evento"
                    (action)="remove(type)"
                  />
                  <keijo-button
                    variant="warning"
                    [icon]="editIcon"
                    tooltip="Modifica il tipo evento"
                    (action)="startEdit(type)"
                  />
                  <keijo-button
                    variant="default"
                    [icon]="type.active ? inactiveIcon : activeIcon"
                    [tooltip]="type.active ? 'Disattiva nel catalogo' : 'Riattiva nel catalogo'"
                    (action)="toggleActive(type)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="emptyIcon" title="Catalogo vuoto" variant="info">
                <span>
                  Senza tipi evento gli organizzatori non possono creare nulla: il tipo è la prima
                  scelta della creazione, e decide come si comporta tutto il resto.
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
export class PlatformEventTypesComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly locale = inject(LocaleService);

  readonly store = inject(EventTypeStore);

  readonly emptyIcon = description;
  readonly activeIcon = toggleOn;
  readonly inactiveIcon = toggleOff;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;
  readonly warningIcon = warning;

  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  /** Ricalcolata a ogni cambio delle checkbox per l'anteprima delle sezioni. */
  private readonly previewTick = signal(0);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    nameIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nameEn: new FormControl('', { nonNullable: true }),
    slug: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    capMultiSession: new FormControl(false, { nonNullable: true }),
    capRoleQuotas: new FormControl(false, { nonNullable: true }),
    capLevels: new FormControl(false, { nonNullable: true }),
    capCast: new FormControl(false, { nonNullable: true }),
    capCouple: new FormControl(false, { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
    sortOrder: new FormControl<string>('0', { nonNullable: true }),
  });

  readonly previewSections = computed(() => {
    this.previewTick();
    const value = this.form.getRawValue();
    return EventTypeStore.sectionsOf(value);
  });

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Tipo evento');
    this.registerActions();
    await this.store.replaceQuery({});
    this.form.valueChanges.subscribe(() => this.previewTick.update((n) => n + 1));
  }

  private registerActions(): void {
    this.pageActions.set([
      {
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea un tipo evento',
        run: () => this.startCreate(),
      } as PageAction,
    ]);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  sectionsOf(type: EventType): string[] {
    return EventTypeStore.sectionsOf(type);
  }

  /**
   * Ogni sezione porta la **sua** icona: riusare una sola icona per nove pill
   * la renderebbe decorativa invece che informativa (`KEIJO-PILL-ICON-SEMANTIC`).
   */
  sectionIcon(section: string): KeijoIconShape {
    return SECTION_ICON[section] ?? description;
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      nameIt: '',
      nameEn: '',
      slug: '',
      capMultiSession: true,
      capRoleQuotas: true,
      capLevels: false,
      capCast: true,
      capCouple: false,
      active: true,
      sortOrder: String(this.store.items().length),
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(type: EventType): void {
    this.editingId.set(type.id);
    this.form.reset({
      nameIt: type.name?.it ?? '',
      nameEn: type.name?.en ?? '',
      slug: type.slug,
      capMultiSession: type.capMultiSession,
      capRoleQuotas: type.capRoleQuotas,
      capLevels: type.capLevels,
      capCast: type.capCast,
      capCouple: type.capCouple,
      active: type.active,
      sortOrder: String(type.sortOrder ?? 0),
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
      this.formErrors.set(['Nome e slug del tipo evento sono obbligatori.']);
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      name: buildI18n(value.nameIt, value.nameEn),
      slug: value.slug.trim(),
      capMultiSession: value.capMultiSession,
      capRoleQuotas: value.capRoleQuotas,
      capLevels: value.capLevels,
      capCast: value.capCast,
      capCouple: value.capCouple,
      active: value.active,
      sortOrder: Number(value.sortOrder) || 0,
    };

    try {
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Tipo evento creato.');
      } else {
        await this.store.update(id, payload);
        this.toast.show('SUCCESS', 'Tipo evento aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async toggleActive(type: EventType): Promise<void> {
    await this.store.update(type.id, { active: !type.active });
    this.toast.show('SUCCESS', type.active ? 'Tipo evento disattivato.' : 'Tipo evento riattivato.');
  }

  async remove(type: EventType): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare il tipo evento?',
      message:
        `«${i18nPlain(type.name, this.locale.lang())}» non sarà più scegliibile alla creazione ` +
        'di un evento. Gli eventi già creati con questo tipo continuano a funzionare. ' +
        'Se serve solo toglierlo dalle scelte, disattivarlo è meno invasivo.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(type.id);
    this.toast.show('SUCCESS', 'Tipo evento eliminato.');
  }
}

/** Icona per ciascuna sezione del workspace attivata dalle cinque capacità. */
const SECTION_ICON: Record<string, KeijoIconShape> = {
  'Dati base': description,
  Sessioni: nightlife,
  'Titoli d’ingresso': sell,
  Requisiti: checklist,
  Servizi: restaurant,
  'Quote di capienza': eventSeat,
  Cast: theaters,
  'Quote per ruolo': scale,
  Livelli: star,
  'Iscrizione a coppia': handshake,
};
