import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
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
} from '@keijo/ui';
import { add, check, close, edit, iconDelete, percent, schedule, swapHoriz } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { RefundPolicy, RefundPolicyTier } from '../../core/domain/models';
import { LocaleService, buildI18n, i18nPlain } from '../../core/i18n/i18n-text';
import { OrganizationStore } from '../../stores/organization.store';
import { RefundPolicyStore } from '../../stores/refund-policy.store';
import { ConfirmService } from '../../shared/confirm.service';
import { I18nTextComponent } from '../../shared/i18n-text.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { OrganizationContextComponent } from './organization-context.component';
import { parseTiers, tiersToText } from './refund-tiers';

/**
 * `/organization/refund-policies` — le policy di rimborso dell'organizzazione
 * (§4.9).
 *
 * Una policy **derivata** da un preset di piattaforma può essere resa **più
 * favorevole al partecipante, mai più restrittiva**: il form confronta le
 * percentuali con quelle del preset da cui discende, ed è `derivedFromPolicyId`
 * a rendere il confronto possibile.
 */
@Component({
  selector: 'app-organization-refund-policies',
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
    SelectComponent,
    CheckboxComponent,
    I18nTextComponent,
    OrganizationContextComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-organization-context current="refund-policies" />

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica policy' : 'Nuova policy di rimborso'"
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
                id="policyNameIt"
                type="text"
              />
              <keijo-select
                [formControl]="form.controls.derivedFromPolicyId"
                [data]="presetOptions()"
                label="derivata dal preset"
                placeholder="Nessun preset di riferimento"
              />
            </keijo-form-row>
            @if (err('nameIt'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            <p class="mirada-hint">
              Il preset di riferimento è ciò che rende verificabile la regola: senza un termine di
              paragone «più favorevole al partecipante» non significa niente.
            </p>

            <keijo-form-row [cols]="1">
              <keijo-input
                [formControl]="form.controls.tiers"
                label="scaglioni (giorni prima : percentuale)"
                id="policyTiers"
                type="text"
                placeholder="30:100, 15:50, 7:0"
              />
            </keijo-form-row>
            @if (err('tiers'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.transferDeadlineHours"
                label="termine per il trasferimento (ore)"
                id="transferDeadline"
                type="number"
                min="0"
              />
              <keijo-checkbox
                [formControl]="form.controls.feeRefundable"
                label="I diritti di prevendita sono rimborsabili"
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
            @for (policy of store.items(); track policy.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title"><app-i18n-text [value]="policy.name" /></span>
                    <span class="mirada-muted">{{ tiersLabel(policy) }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    @if (policy.isPlatformPreset) {
                      <keijo-pill variant="info" [icon]="policyIcon">preset di piattaforma</keijo-pill>
                    }
                    @if (policy.derivedFromPolicy) {
                      <keijo-pill variant="default" [icon]="derivedIcon">
                        derivata da <app-i18n-text [value]="policy.derivedFromPolicy.name" />
                      </keijo-pill>
                    }
                    <keijo-pill variant="default" [icon]="deadlineIcon">
                      trasferibile fino a {{ policy.transferDeadlineHours }} ore prima
                    </keijo-pill>
                    <keijo-pill variant="default" [icon]="policyIcon">
                      diritti di prevendita
                      {{ policy.feeRefundable ? 'rimborsabili' : 'non rimborsabili' }}
                    </keijo-pill>
                  </div>
                </ng-template>
                <ng-template #actions>
                  @if (!policy.isPlatformPreset) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Elimina la policy"
                      (action)="remove(policy)"
                    />
                    <keijo-button
                      variant="warning"
                      [icon]="editIcon"
                      tooltip="Modifica la policy"
                      (action)="startEdit(policy)"
                    />
                  }
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="policyIcon" title="Nessuna policy" variant="info">
                <span>
                  Senza una policy propria vale il preset di piattaforma scelto sull’evento. Una
                  policy dell’organizzazione serve quando si vuole essere più generosi del preset.
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
export class OrganizationRefundPoliciesComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly locale = inject(LocaleService);
  private readonly organizations = inject(OrganizationStore);

  readonly store = inject(RefundPolicyStore);

  readonly policyIcon = percent;
  readonly derivedIcon = swapHoriz;
  readonly deadlineIcon = schedule;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  private readonly presets = signal<RefundPolicy[]>([]);

  readonly presetOptions = computed<SelectOption[]>(() => [
    { label: 'Nessun preset di riferimento', value: null },
    ...this.presets().map((p) => ({
      label: i18nPlain(p.name, this.locale.lang()),
      value: p.id,
    })),
  ]);

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
    derivedFromPolicyId: new FormControl<number | null>(null),
  });

  readonly organizationId = computed(() => this.organizations.current()?.id ?? null);

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Policy di rimborso');
    await this.organizations.replaceQuery({});
    const first = this.organizations.items()[0];
    if (first) await this.organizations.loadOne(first.id);

    const orgId = this.organizationId();
    await this.store.replaceQuery(orgId ? { organizationId: orgId } : {});
    this.presets.set(await this.store.loadAll({ isPlatformPreset: true }, 100, ''));
    this.registerActions();
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.organizationId()) {
      actions.push({
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea una policy di rimborso',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  tiersLabel(policy: RefundPolicy): string {
    return tiersToText(policy.tiers) || 'Nessuno scaglione configurato';
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      nameIt: '',
      nameEn: '',
      tiers: '',
      transferDeadlineHours: '0',
      feeRefundable: false,
      derivedFromPolicyId: null,
    });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(policy: RefundPolicy): void {
    this.editingId.set(policy.id);
    this.form.reset({
      nameIt: policy.name?.it ?? '',
      nameEn: policy.name?.en ?? '',
      tiers: tiersToText(policy.tiers),
      transferDeadlineHours: String(policy.transferDeadlineHours ?? 0),
      feeRefundable: policy.feeRefundable,
      derivedFromPolicyId: policy.derivedFromPolicyId ?? null,
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
      this.formErrors.set(['Il nome della policy è obbligatorio.']);
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

    // Più favorevole al partecipante, mai più restrittiva del preto da cui deriva.
    const preset = this.presets().find((p) => p.id === Number(value.derivedFromPolicyId));
    const violations = RefundPolicyStore.compareWithPreset(tiers, preset?.tiers);
    if (violations.length) {
      this.formErrors.set(violations);
      return;
    }

    try {
      const payload = {
        name: buildI18n(value.nameIt, value.nameEn),
        tiers,
        transferDeadlineHours: Number(value.transferDeadlineHours) || 0,
        feeRefundable: value.feeRefundable,
        isPlatformPreset: false,
        organizationId: orgId,
        derivedFromPolicyId: value.derivedFromPolicyId ? Number(value.derivedFromPolicyId) : null,
      };
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Policy di rimborso creata.');
      } else {
        await this.store.update(id, payload);
        this.toast.show('SUCCESS', 'Policy di rimborso aggiornata.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(policy: RefundPolicy): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare la policy?',
      message:
        `«${i18nPlain(policy.name, this.locale.lang())}» non sarà più selezionabile per i nuovi ` +
        'eventi. Gli eventi che la usano continuano ad applicarla a chi ha già comprato.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(policy.id);
    this.toast.show('SUCCESS', 'Policy eliminata.');
  }
}
