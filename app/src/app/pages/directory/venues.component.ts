import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';
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
  PaginationComponent,
  PillComponent,
  SearchBarComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
  TextareaComponent,
} from '@keijo/ui';
import {
  acUnit,
  accessible,
  add,
  check,
  close,
  directionsCar,
  edit,
  eventSeat,
  iconDelete,
  locationOn,
  warning,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { ApiError } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { Address, Venue } from '../../core/domain/models';
import { AddressStore, formatAddress } from '../../stores/address.store';
import { VenueStore } from '../../stores/venue.store';
import { ConfirmService } from '../../shared/confirm.service';
import {
  AddressFieldsComponent,
  addressPayload,
  buildAddressForm,
} from '../../shared/address-fields.component';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';

/**
 * `/directory/venues` — le **location** riutilizzabili fra eventi (§4.8).
 *
 * La `capacity` dichiarata qui è **proposta come default** alla creazione della
 * quota di capienza della sala, **mai imposta**: assenza di quota significa
 * assenza di vincolo.
 *
 * `Venue.addressId` è obbligatorio e `Address` ha la **base REST piena** (§3.4):
 * l'indirizzo si compone qui e viene creato con `POST /addresses/create` prima
 * della location, oppure si sceglie fra quelli già in archivio.
 *
 * `DELETE /addresses/:id` è una **cancellazione reale**, non un cestino:
 * `Address` è l'unica entità del dialetto priva della colonna `deleted`. Un
 * indirizzo ancora referenziato risponde `400`, ed è un vincolo, non un errore.
 */
@Component({
  selector: 'app-venues',
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
    ButtonComponent,
    PaginationComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    InputComponent,
    TextareaComponent,
    CheckboxComponent,
    SelectComponent,
    AddressFieldsComponent,
  ],
  template: `
    <keijo-page-wrapper>
      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Modifica location' : 'Nuova location'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.name"
                label="nome"
                id="venueName"
                type="text"
              />
              <keijo-input
                [formControl]="form.controls.capacity"
                label="capienza"
                id="venueCapacity"
                type="number"
                min="0"
              />
            </keijo-form-row>
            @if (err('name'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
            <p class="mirada-hint">
              La capienza qui è un dato dell’anagrafica: viene proposta come valore di partenza
              per la quota di capienza della sala, mai applicata da sola.
            </p>

            <p class="mirada-label">Indirizzo</p>
            <keijo-form-row [cols]="2">
              <keijo-select
                [formControl]="addressMode"
                [data]="addressModeOptions"
                label="come indicarlo"
                placeholder="Nuovo indirizzo o già in archivio"
              />
              @if (addressMode.value === 'existing') {
                <keijo-select
                  [formControl]="existingAddressId"
                  [data]="addressOptions()"
                  label="indirizzo in archivio"
                  placeholder="Scegli un indirizzo già registrato"
                />
              }
            </keijo-form-row>

            @if (addressMode.value === 'existing') {
              <p class="mirada-hint">
                Gli indirizzi sono riusabili: la stessa sede vale per più location e per la sede
                dell’organizzazione.
              </p>
              @if (addressError(); as msg) {
                <p class="mirada-error">{{ msg }}</p>
              }
              @if (canWrite() && existingAddressId.value) {
                <div class="address-actions">
                  <keijo-button
                    variant="error"
                    [icon]="deleteIcon"
                    label="Elimina indirizzo"
                    tooltip="Cancellazione definitiva dell’indirizzo dall’archivio"
                    (action)="removeAddress()"
                  />
                </div>
              }
            } @else {
              <app-address-fields [form]="addressForm" prefix="venueAddr" />
            }

            <keijo-form-row [cols]="2">
              <keijo-input
                [formControl]="form.controls.latitude"
                label="latitudine"
                id="venueLat"
                type="number"
                step="0.000001"
              />
              <keijo-input
                [formControl]="form.controls.longitude"
                label="longitudine"
                id="venueLng"
                type="number"
                step="0.000001"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="3">
              <keijo-checkbox
                [formControl]="form.controls.airConditioning"
                label="climatizzata"
              />
              <keijo-checkbox [formControl]="form.controls.parking" label="parcheggio" />
              <keijo-input
                [formControl]="form.controls.accessibility"
                label="accessibilità"
                id="venueAccessibility"
                type="text"
              />
            </keijo-form-row>

            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.floorNotes"
                label="note sul pavimento"
                id="venueFloorNotes"
                [rows]="2"
              />
            </keijo-form-row>
            <keijo-form-row [cols]="1">
              <keijo-textarea
                [formControl]="form.controls.notes"
                label="note"
                id="venueNotes"
                [rows]="2"
              />
            </keijo-form-row>
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        <keijo-search-bar [search]="search" filterTooltip="Filtra le location" />

        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (venue of store.items(); track venue.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title">{{ venue.name }}</span>
                    <span class="mirada-muted">{{ addressLine(venue) }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    @if (venue.capacity) {
                      <keijo-pill
                        variant="info"
                        [icon]="seatIcon"
                        tooltip="Capienza dichiarata in anagrafica"
                      >
                        {{ venue.capacity }} posti
                      </keijo-pill>
                    }
                    @if (venue.airConditioning) {
                      <keijo-pill variant="default" [icon]="acIcon">climatizzata</keijo-pill>
                    }
                    @if (venue.parking) {
                      <keijo-pill variant="default" [icon]="parkingIcon">parcheggio</keijo-pill>
                    }
                    @if (venue.accessibility) {
                      <keijo-pill variant="default" [icon]="accessIcon">{{
                        venue.accessibility
                      }}</keijo-pill>
                    }
                    @if (venue.floorNotes) {
                      <span class="mirada-muted">{{ venue.floorNotes }}</span>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  @if (canWrite()) {
                    <keijo-button
                      variant="error"
                      [icon]="deleteIcon"
                      tooltip="Elimina la location"
                      (action)="remove(venue)"
                    />
                    <keijo-button
                      variant="warning"
                      [icon]="editIcon"
                      tooltip="Modifica la location"
                      (action)="startEdit(venue)"
                    />
                  }
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="venueIcon" title="Nessuna location" variant="info">
                <span>
                  Le location vivono nell’anagrafica e si riusano fra edizioni: la sala di
                  quest’anno è la stessa dell’anno prossimo, con la stessa capienza e le stesse
                  note sul pavimento.
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
      .address-actions {
        display: flex;
        gap: 0.375rem;
      }
    `,
  ],
})
export class VenuesComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);

  readonly store = inject(VenueStore);
  readonly addresses = inject(AddressStore);

  readonly venueIcon = locationOn;
  readonly seatIcon = eventSeat;
  readonly acIcon = acUnit;
  readonly parkingIcon = directionsCar;
  readonly accessIcon = accessible;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;
  readonly warningIcon = warning;

  readonly search = new FormControl('', { nonNullable: true });
  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly addressError = signal<string | null>(null);

  /** `Address` ha la base REST piena: si crea qui, oppure si riusa (§3.4). */
  readonly addressForm = buildAddressForm();
  readonly addressMode = new FormControl<'new' | 'existing'>('new', { nonNullable: true });
  readonly existingAddressId = new FormControl<number | null>(null);

  readonly addressModeOptions: SelectOption[] = [
    { label: 'Nuovo indirizzo', value: 'new' },
    { label: 'Indirizzo già in archivio', value: 'existing' },
  ];

  readonly addressOptions = computed<SelectOption[]>(() =>
    this.addresses.items().map((a) => ({ label: formatAddress(a) || `Indirizzo #${a.id}`, value: a.id })),
  );

  readonly canWrite = computed(() => this.auth.can().directoryWrite);

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    capacity: new FormControl<string>('', { nonNullable: true }),
    latitude: new FormControl<string>('', { nonNullable: true }),
    longitude: new FormControl<string>('', { nonNullable: true }),
    floorNotes: new FormControl('', { nonNullable: true }),
    airConditioning: new FormControl(false, { nonNullable: true }),
    parking: new FormControl(false, { nonNullable: true }),
    accessibility: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((value) => void this.store.setQuery({ value: value || undefined }));
  }

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Location');
    this.registerActions();
    await Promise.all([this.store.replaceQuery({}), this.loadAddresses()]);
  }

  /**
   * L'archivio delle sedi cresce con la piattaforma: qui la paginazione è
   * quella vera, non un insieme da leggere intero.
   */
  onPage(page: number): void {
    void this.store.setPage(page);
  }

  onPageSize(size: number): void {
    void this.store.setPageSize(size);
  }

  /** `POST /addresses/` — l'archivio degli indirizzi riusabili (§3.4). */
  private async loadAddresses(): Promise<void> {
    try {
      await this.addresses.replaceQuery({});
    } catch {
      /* il gating lato server può negare la lettura: resta la sola creazione */
    }
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.canWrite()) {
      actions.push({
        id: 'create',
        icon: add,
        label: 'Crea',
        tooltip: 'Crea una location',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  addressLine(venue: Venue): string {
    return formatAddress(venue.address) || 'Indirizzo non collegato';
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      capacity: '',
      latitude: '',
      longitude: '',
      floorNotes: '',
      airConditioning: false,
      parking: false,
      accessibility: '',
      notes: '',
    });
    this.resetAddress(null);
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(venue: Venue): void {
    this.editingId.set(venue.id);
    this.form.reset({
      name: venue.name,
      capacity: venue.capacity != null ? String(venue.capacity) : '',
      latitude: venue.latitude != null ? String(venue.latitude) : '',
      longitude: venue.longitude != null ? String(venue.longitude) : '',
      floorNotes: venue.floorNotes ?? '',
      airConditioning: venue.airConditioning,
      parking: venue.parking,
      accessibility: venue.accessibility ?? '',
      notes: venue.notes ?? '',
    });
    this.resetAddress(venue.address ?? null);
    this.formErrors.set([]);
    this.editing.set(true);
  }

  /**
   * Prepara la sezione indirizzo: in modifica i campi arrivano popolati
   * dall'indirizzo collegato, in creazione il form è vuoto.
   */
  private resetAddress(address: Address | null): void {
    this.addressError.set(null);
    this.existingAddressId.setValue(address?.id ?? null);
    this.addressMode.setValue('new');
    this.addressForm.reset({
      address: address?.address ?? '',
      number: address?.number ?? '',
      zipCode: address?.zipCode ?? '',
      city: address?.city ?? '',
      province: address?.province ?? '',
      country: address?.country ?? 'Italia',
      note: address?.note ?? '',
    });
  }

  async onEditAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.editing.set(false);
      return;
    }
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);
    this.addressError.set(null);
    if (this.form.invalid) {
      this.formErrors.set(['Il nome della location è obbligatorio.']);
      return;
    }

    let addressId: number;
    try {
      addressId = await this.resolveAddressId();
    } catch (err) {
      this.addressError.set(
        err instanceof ApiError ? err.message : 'L’indirizzo non è stato salvato.',
      );
      if (err instanceof ApiError && err.kind === 'validation') {
        this.addressForm.markAllAsTouched();
        applyZodIssues(this.addressForm, err);
      }
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      name: value.name.trim(),
      addressId,
      capacity: value.capacity ? Number(value.capacity) : null,
      latitude: value.latitude ? Number(value.latitude) : null,
      longitude: value.longitude ? Number(value.longitude) : null,
      floorNotes: value.floorNotes.trim() || null,
      airConditioning: value.airConditioning,
      parking: value.parking,
      accessibility: value.accessibility.trim() || null,
      notes: value.notes.trim() || null,
    };

    try {
      const id = this.editingId();
      if (id === null) {
        await this.store.create(payload);
        this.toast.show('SUCCESS', 'Location creata.');
      } else {
        await this.store.update(id, payload);
        this.toast.show('SUCCESS', 'Location aggiornata.');
      }
      this.editing.set(false);
      await Promise.all([this.store.load(), this.loadAddresses()]);
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  /**
   * Risolve l'indirizzo della location: lo **crea** (`POST /addresses/create`),
   * lo **aggiorna** (`PATCH /addresses/:id`) o riusa quello scelto in archivio.
   */
  private async resolveAddressId(): Promise<number> {
    if (this.addressMode.value === 'existing') {
      const chosen = this.existingAddressId.value;
      if (chosen == null) throw new ApiError('validation', 'Scegli un indirizzo dall’archivio.', 400);
      return chosen;
    }

    this.addressForm.markAllAsTouched();
    if (this.addressForm.invalid) {
      throw new ApiError('validation', 'Via e città dell’indirizzo sono obbligatorie.', 400);
    }

    const payload = addressPayload(this.addressForm);
    const linked = this.existingAddressId.value;
    const saved =
      linked == null
        ? await this.addresses.create(payload)
        : await this.addresses.update(linked, payload);
    return saved.id;
  }

  /**
   * `DELETE /addresses/:id` — **cancellazione reale**: `Address` è l'unica
   * entità del dialetto priva della colonna `deleted`, quindi non finisce in un
   * cestino da cui si possa ripescare. Un indirizzo ancora referenziato
   * risponde `400`, ed è un vincolo, non un errore.
   */
  async removeAddress(): Promise<void> {
    const id = this.existingAddressId.value;
    if (id == null) return;
    const address = this.addresses.items().find((a) => a.id === id) ?? null;

    const ok = await this.confirm.ask({
      title: 'Eliminare definitivamente l’indirizzo?',
      message:
        `«${formatAddress(address) || `Indirizzo #${id}`}» viene rimosso dall’archivio in modo ` +
        'definitivo: non finisce in un cestino e non è recuperabile. Se è ancora usato da una ' +
        'location o dalla sede dell’organizzazione, la cancellazione viene rifiutata.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;

    try {
      await this.addresses.remove(id);
      this.existingAddressId.setValue(null);
      this.addressError.set(null);
      this.toast.show('SUCCESS', 'Indirizzo eliminato.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        this.addressError.set(err.message);
        return;
      }
      this.addressError.set('L’indirizzo non è stato eliminato.');
    }
  }

  async remove(venue: Venue): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminare la location?',
      message:
        `«${venue.name}» non sarà più selezionabile per i nuovi eventi. ` +
        'Gli eventi che la usano già continuano a puntarla.',
      confirmLabel: 'Elimina',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(venue.id);
    this.toast.show('SUCCESS', 'Location eliminata.');
  }
}
