import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  InputComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
} from '@keijo/ui';
import { accountBalance, description, save } from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { Organization, StoredFile } from '../../core/domain/models';
import { formatDateTime } from '../../core/i18n/format';
import { AddressStore } from '../../stores/address.store';
import { OrganizationStore } from '../../stores/organization.store';
import {
  AddressFieldsComponent,
  addressPayload,
  buildAddressForm,
} from '../../shared/address-fields.component';
import { ASPECT_SQUARE, ImageUploadComponent } from '../../shared/image-upload.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { OrganizationContextComponent } from './organization-context.component';

/**
 * `/organization` — anagrafica e dati fiscali dell'organizzazione (§4.9).
 *
 * **Non è una pagina di impostazioni**: è la gestione di un'entità di dominio,
 * e la sua categoria è `entity-management`.
 *
 * `stripeAccountId`, `payoutStatus` e `payoutCheckedAt` sono calcolati dal
 * server: qui si leggono, non si scrivono.
 */
@Component({
  selector: 'app-organization-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    InfoBoxComponent,
    OrganizationContextComponent,
    AddressFieldsComponent,
    ImageUploadComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-organization-context current="profile" />

      @if (store.current(); as org) {
        <keijo-page-section-wrapper title="Anagrafica e dati fiscali">
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.name"
                label="denominazione"
                id="orgName"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.legalName"
                label="ragione sociale"
                id="orgLegalName"
                type="text"
              />
            </keijo-form-row>
            @if (err('name'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <keijo-form-row [cols]="3">
              <keijo-input
                [formControl]="form.controls.legalForm"
                label="forma giuridica"
                id="orgLegalForm"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.vatNumber"
                label="Partita IVA"
                id="orgVat"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.taxCode"
                label="codice fiscale"
                id="orgTaxCode"
                type="text"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="3">
              <keijo-input
                [formControl]="form.controls.contactEmail"
                label="email di riferimento"
                id="orgEmail"
                type="email"
              />
              <keijo-input
                [formControl]="form.controls.contactPhone"
                label="telefono"
                id="orgPhone"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.website"
                label="sito"
                id="orgWebsite"
                type="text"
              />
            </keijo-form-row>
            @if (err('contactEmail'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <p class="mirada-label">Sede</p>
            <app-address-fields [form]="addressForm" prefix="orgAddr" />
            @if (addressError(); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }

            <p class="mirada-label">Logo</p>
            <app-image-upload
              label="Logo dell’organizzazione"
              hint="Compare nella scheda pubblica degli eventi e nelle comunicazioni. Formato quadrato."
              [aspect]="logoAspect"
              [fileId]="logoFileId()"
              [currentUrl]="logoUrl()"
              [readonly]="!canWrite()"
              (uploaded)="onLogoUploaded($event)"
              (cleared)="onLogoCleared()"
            />
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>

        <keijo-page-section-wrapper title="Condizioni di servizio">
          <div class="grid">
            <div>
              <p class="mirada-label">Versione accettata</p>
              <p class="mirada-value">{{ org.termsVersion ?? 'Nessuna accettazione registrata' }}</p>
            </div>
            <div>
              <p class="mirada-label">Data di accettazione</p>
              <p class="mirada-value">{{ when(org.termsAcceptedAt) }}</p>
            </div>
          </div>
          <keijo-info-box
            [icon]="termsIcon"
            title="Scarica le condizioni accettate"
            variant="info"
          >
            <span>
              Il §4.9 prevede qui il download del testo accettato e il collegamento dell’account
              di incasso. Il contratto API condiviso non dichiara né un endpoint di download né
              l’avvio dell’onboarding presso il prestatore di pagamento: le due azioni compariranno
              quando saranno dichiarate.
            </span>
          </keijo-info-box>
        </keijo-page-section-wrapper>

        <keijo-page-section-wrapper title="Stato di incasso">
          <p class="mirada-value">
            {{ payoutLine(org) }}
          </p>
          <p class="mirada-hint">
            La decadenza dell’abilitazione sospende la vendita online, ma i biglietti già emessi
            restano validi e i rimborsi restano eseguibili. Il dettaglio degli adempimenti
            mancanti è nella scheda Incasso.
          </p>
        </keijo-page-section-wrapper>
      } @else {
        <keijo-page-section-wrapper mode="plain">
          <keijo-info-box
            [icon]="orgIcon"
            title="Nessuna organizzazione accessibile"
            variant="warning"
          >
            <span>
              Il tuo utente non risulta membro di alcuna organizzazione. Un Super Admin deve
              crearla e collegarti come membro prima che tu possa gestirla.
            </span>
          </keijo-info-box>
        </keijo-page-section-wrapper>
      }
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      }
    `,
  ],
})
export class OrganizationProfileComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly store = inject(OrganizationStore);
  private readonly addresses = inject(AddressStore);

  readonly orgIcon = accountBalance;
  readonly termsIcon = description;

  readonly formErrors = signal<string[]>([]);
  readonly addressError = signal<string | null>(null);
  readonly canWrite = computed(() => this.auth.can().organization);

  /** `Address` ha la base REST piena (§3.4): la sede si compila, non si indicizza. */
  readonly addressForm = buildAddressForm();

  /** Il logo è un **riferimento** a `File`: si sostituisce, non si modifica. */
  readonly logoFileId = signal<number | null>(null);
  readonly logoUrl = signal<string | null>(null);
  readonly logoAspect = ASPECT_SQUARE;

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    legalName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    legalForm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    vatNumber: new FormControl('', { nonNullable: true }),
    taxCode: new FormControl('', { nonNullable: true }),
    contactEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    contactPhone: new FormControl('', { nonNullable: true }),
    website: new FormControl('', { nonNullable: true }),
  });

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Organizzazione');
    await this.store.replaceQuery({});
    const first = this.store.items()[0];
    if (first) {
      const org = await this.store.loadOne(first.id);
      this.patch(org);
    }
    this.registerActions();
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite() && this.store.current()) {
      actions.push({
        id: 'save',
        icon: save,
        label: 'Salva',
        tooltip: 'Salva l’anagrafica dell’organizzazione',
        run: () => void this.save(),
      });
    }
    this.pageActions.set(actions);
  }

  private patch(org: Organization): void {
    this.form.patchValue({
      name: org.name,
      legalName: org.legalName,
      legalForm: org.legalForm,
      vatNumber: org.vatNumber ?? '',
      taxCode: org.taxCode ?? '',
      contactEmail: org.contactEmail,
      contactPhone: org.contactPhone ?? '',
      website: org.website ?? '',
    });
    const address = org.address ?? null;
    this.addressForm.reset({
      address: address?.address ?? '',
      number: address?.number ?? '',
      zipCode: address?.zipCode ?? '',
      city: address?.city ?? '',
      province: address?.province ?? '',
      country: address?.country ?? 'Italia',
      note: address?.note ?? '',
    });
    this.logoFileId.set(org.logoFileId ?? null);
    this.logoUrl.set(org.logoFile?.url ?? null);
  }

  /**
   * Il file è già caricato: qui si scrive il **riferimento** sull'organizzazione
   * con il suo `PATCH`. Nessun `UPDATE` né `DELETE` sul file (§3.4).
   */
  async onLogoUploaded(file: StoredFile): Promise<void> {
    this.logoFileId.set(file.id);
    this.logoUrl.set(file.url);
    const org = this.store.current();
    if (!org) return;
    await this.store.update(org.id, { logoFileId: file.id });
    this.toast.show('SUCCESS', 'Logo collegato all’organizzazione.');
  }

  async onLogoCleared(): Promise<void> {
    this.logoFileId.set(null);
    this.logoUrl.set(null);
    const org = this.store.current();
    if (!org) return;
    await this.store.update(org.id, { logoFileId: null });
    this.toast.show('SUCCESS', 'Logo scollegato.');
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  when(value: string | null | undefined): string {
    return formatDateTime(value);
  }

  payoutLine(org: Organization): string {
    const checked = org.payoutCheckedAt
      ? ` Ultima verifica: ${formatDateTime(org.payoutCheckedAt)}.`
      : ' Nessuna verifica ancora effettuata.';
    return `Stato attuale presso il prestatore di pagamento.${checked}`;
  }

  async save(): Promise<void> {
    const org = this.store.current();
    if (!org) return;

    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);
    this.addressError.set(null);
    if (this.form.invalid) {
      this.formErrors.set(['Denominazione, ragione sociale, forma giuridica ed email sono obbligatorie.']);
      return;
    }

    let addressId: number | null;
    try {
      addressId = await this.saveAddress(org);
    } catch (err) {
      this.addressError.set(
        err instanceof ApiError ? err.message : 'La sede non è stata salvata.',
      );
      return;
    }

    const value = this.form.getRawValue();
    try {
      await this.store.update(org.id, {
        addressId,
        name: value.name.trim(),
        legalName: value.legalName.trim(),
        legalForm: value.legalForm.trim(),
        vatNumber: value.vatNumber.trim() || null,
        taxCode: value.taxCode.trim() || null,
        contactEmail: value.contactEmail.trim(),
        contactPhone: value.contactPhone.trim() || null,
        website: value.website.trim() || null,
      });
      this.toast.show('SUCCESS', 'Anagrafica salvata.');
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  /**
   * Crea (`POST /addresses/create`) o aggiorna (`PATCH /addresses/:id`) la sede.
   * Una sede lasciata vuota resta scollegata: `Organization.addressId` è
   * nullable e l'assenza di sede non va inventata.
   */
  private async saveAddress(org: Organization): Promise<number | null> {
    const value = this.addressForm.getRawValue();
    const filled = value.address.trim() !== '' || value.city.trim() !== '';
    if (!filled) return org.addressId ?? null;

    this.addressForm.markAllAsTouched();
    if (this.addressForm.invalid) {
      throw new ApiError('validation', 'Via e città della sede sono obbligatorie.', 400);
    }

    const payload = addressPayload(this.addressForm);
    const saved =
      org.addressId == null
        ? await this.addresses.create(payload)
        : await this.addresses.update(org.addressId, payload);
    return saved.id;
  }
}
