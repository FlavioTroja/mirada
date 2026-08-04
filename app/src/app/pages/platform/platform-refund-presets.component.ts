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
} from '@keijo/ui';
import { add, check, close, edit, iconDelete, percent, schedule } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { RefundPolicy, RefundPolicyTier } from '../../core/domain/models';
import { LocaleService, buildI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { RefundPolicyStore } from '../../stores/refund-policy.store';
import { ConfirmService } from '../../shared/confirm.service';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { parseTiers, tiersToText } from '../organization/refund-tiers';

/**
 * `/platform/refund-presets` — i **preset di rimborso di piattaforma**
 * (§4.10, `GOD`).
 *
 * Sono il termine di paragone delle policy delle organizzazioni: una policy
 * derivata può essere più favorevole al partecipante, mai più restrittiva.
 * Cambiare un preset cambia quel confronto per tutte le policy che vi
 * discendono.
 */
@Component({
  selector: 'app-platform-refund-presets',
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
          [title]="editingId() ? 'Modifica preset' : 'Nuovo preset di rimborso'"
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
                id="presetNameIt"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.nameEn"
                label="nome (inglese)"
                id="presetNameEn"
                type="text"
              />
            </keijo-form-row>
            @if (err('nameIt'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="1">
              <keijo-input
                [formControl]="form.controls.tiers"
                label="scaglioni (giorni prima : percentuale)"
                id="presetTiers"
                type="text"
                placeholder="30:100, 15:50, 7:0"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.transferDeadlineHours"
                label="termine per il trasferimento (ore)"
                id="presetDeadline"
                type="number"
                min="0"
              />
              <keijo-checkbox
                [formControl]="form.controls.feeRefundable"
                label="I diritti di prevendita sono rimborsabili"
              />
            </keijo-form-row>
            <p class="mirada-hint">
              I diritti di prevendita sono ricavo della piattaforma e nei testi rivolti al
              pubblico si chiamano così: mai «commissione», mai «fee».
            </p>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (preset of store.items(); track preset.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title"><app-i18n-text [value]="preset.name" /></span>
                    <span class="mirada-muted">{{ tiersLabel(preset) }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <keijo-pill variant="default" [icon]="deadlineIcon">
                      trasferibile fino a {{ preset.transferDeadlineHours }} ore prima
                    </keijo-pill>
                    <keijo-pill variant="default" [icon]="presetIcon">
                      diritti di prevendita
                      {{ preset.feeRefundable ? 'rimborsabili' : 'non rimborsabili' }}
                    </keijo-pill>
                  </div>
                </ng-template>
                <ng-template #actions>
                  <keijo-button
                    variant="error"
                    [icon]="deleteIcon"
                    tooltip="Elimina il preset"
                    (action)="remove(preset)"
                  />
                  <keijo-button
                    variant="warning"
                    [icon]="editIcon"
                    tooltip="Modifica il preset"
                    (action)="startEdit(preset)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="presetIcon" title="Nessun preset" variant="info">
                <span>
                  I preset di piattaforma sono la base su cui gli organizzatori costruiscono le
                  proprie policy: senza di essi «più favorevole al partecipante» non ha un termine
                  di paragone.
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
export class PlatformRefundPresetsComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly locale = inject(LocaleService);

  readonly store = inject(RefundPolicyStore);

  readonly presetIcon = percent;
  readonly deadlineIcon = schedule;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    nameIt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nameEn: new FormControl('', { nonNullable: true }),
    tiers: new FormControl('', { nonNullable: true }),
    transferDeadlineHours: new FormControl<string>('0', { nonNullable: true }),
    feeRefundable: new FormControl(false, { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Preset di rimborso');
    this.registerActions();
    await this.store.replaceQuery({ isPlatformPreset: true });
  }

  private registerActions(): void {
    this.pageActions.set([
      {
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea un preset di rimborso',
        run: () => this.startCreate(),
      } as PageAction,
    ]);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  tiersLabel(preset: RefundPolicy): string {
    return tiersToText(preset.tiers) || 'Nessuno scaglione configurato';
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      nameIt: '',
      nameEn: '',
      tiers: '',
      transferDeadlineHours: '0',
      feeRefundable: false,
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(preset: RefundPolicy): void {
    this.editingId.set(preset.id);
    this.form.reset({
      nameIt: preset.name?.it ?? '',
      nameEn: preset.name?.en ?? '',
      tiers: tiersToText(preset.tiers),
      transferDeadlineHours: String(preset.transferDeadlineHours ?? 0),
      feeRefundable: preset.feeRefundable,
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
      this.formErrors.set(['Il nome del preset è obbligatorio.']);
      return;
    }

    const value = this.form.getRawValue();
    let tiers: RefundPolicyTier[];
    try {
      tiers = parseTiers(value.tiers);
    } catch (parseError) {
      this.formErrors.set([(parseError as Error).message]);
      return;
    }

    try {
      const payload = {
        name: buildI18n(value.nameIt, value.nameEn),
        tiers,
        transferDeadlineHours: Number(value.transferDeadlineHours) || 0,
        feeRefundable: value.feeRefundable,
        isPlatformPreset: true,
        organizationId: null,
      };
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Preset creato.');
      } else {
        await this.store.update(id, payload);
        this.toast.show('SUCCESS', 'Preset aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(preset: RefundPolicy): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare il preset?',
      message:
        `«${i18nPlain(preset.name, this.locale.lang())}» non sarà più disponibile come base. ` +
        'Le policy che vi discendono perdono il termine di paragone che rende verificabile la ' +
        'regola «più favorevole al partecipante».',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(preset.id);
    this.toast.show('SUCCESS', 'Preset eliminato.');
  }
}
