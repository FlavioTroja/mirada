import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormRowComponent, InputComponent } from '@keijo/ui';

/** Il gruppo di campi che compone un `Address` (§3.6). */
export interface AddressFormGroup {
  address: FormControl<string>;
  number: FormControl<string>;
  zipCode: FormControl<string>;
  city: FormControl<string>;
  province: FormControl<string>;
  country: FormControl<string>;
  note: FormControl<string>;
}

/** Costruisce il gruppo con le sue validazioni. Via e città sono il minimo utile. */
export function buildAddressForm(): FormGroup<AddressFormGroup> {
  return new FormGroup<AddressFormGroup>({
    address: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    number: new FormControl('', { nonNullable: true }),
    zipCode: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    province: new FormControl('', { nonNullable: true }),
    country: new FormControl('Italia', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });
}

/** Valori del form → corpo di `POST /addresses/create` o `PATCH /addresses/:id`. */
export function addressPayload(form: FormGroup<AddressFormGroup>): Record<string, string | null> {
  const v = form.getRawValue();
  return {
    address: v.address.trim(),
    number: v.number.trim() || null,
    zipCode: v.zipCode.trim() || null,
    city: v.city.trim(),
    province: v.province.trim().toUpperCase() || null,
    country: v.country.trim() || null,
    note: v.note.trim() || null,
  };
}

/**
 * Campi di un indirizzo, riusati ovunque un'entità ne porti uno
 * (`Venue.addressId`, `Organization.addressId`).
 *
 * `Address` ha la **base REST piena** `/addresses` (§3.4): l'indirizzo si crea
 * e si aggiorna come qualunque altra entità, e non si collega più indicandone
 * l'identificativo.
 */
@Component({
  selector: 'app-address-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormRowComponent, InputComponent],
  template: `
    <keijo-form-row [cols]="3">
      <keijo-input
        [formControl]="form().controls.address"
        label="via o piazza"
        [id]="prefix() + 'Street'"
        type="text"
      />
      <keijo-input
        [formControl]="form().controls.number"
        label="numero civico"
        [id]="prefix() + 'Number'"
        type="text"
      />
      <keijo-input
        [formControl]="form().controls.zipCode"
        label="CAP"
        [id]="prefix() + 'Zip'"
        type="text"
      />
    </keijo-form-row>

    <keijo-form-row [cols]="3">
      <keijo-input
        [formControl]="form().controls.city"
        label="città"
        [id]="prefix() + 'City'"
        type="text"
      />
      <keijo-input
        [formControl]="form().controls.province"
        label="provincia"
        [id]="prefix() + 'Province'"
        type="text"
      />
      <keijo-input
        [formControl]="form().controls.country"
        label="nazione"
        [id]="prefix() + 'Country'"
        type="text"
      />
    </keijo-form-row>

    <keijo-form-row [cols]="1">
      <keijo-input
        [formControl]="form().controls.note"
        label="indicazioni per chi arriva"
        [id]="prefix() + 'Note'"
        type="text"
      />
    </keijo-form-row>
  `,
})
export class AddressFieldsComponent {
  readonly form = input.required<FormGroup<AddressFormGroup>>();
  /** Prefisso degli `id` dei campi: due form d'indirizzo nella stessa pagina non collidono. */
  readonly prefix = input('address');
}
