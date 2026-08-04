import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  NavigationButtonComponent,
  PageSectionWrapperComponent,
  PillComponent,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import { chevronRight, description, domain, groups, payments, percent } from '@keijo/ui/icons';
import { Router } from '@angular/router';
import { ORGANIZATION_STATUS_UI, PAYOUT_STATUS_UI } from '../../core/domain/enums';
import { OrganizationStore } from '../../stores/organization.store';
import { StatusPillComponent } from '../../shared/status-pill.component';

/**
 * Contesto della rotta `/organization`: identità dell'organizzazione corrente,
 * stato di approvazione e di incasso, e navigazione fra le sue schede.
 *
 * Quando l'utente ha accesso a più organizzazioni (è il caso del Super Admin)
 * compare un selettore: le rotte sotto `/organization` lavorano sempre su
 * quella selezionata.
 */
@Component({
  selector: 'app-organization-context',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageSectionWrapperComponent,
    NavigationButtonComponent,
    SelectComponent,
    PillComponent,
    StatusPillComponent,
  ],
  template: `
    @if (organization(); as org) {
      <keijo-page-section-wrapper>
        <div class="head">
          <div>
            <h2 class="title">{{ org.name }}</h2>
            <p class="mirada-muted">{{ org.legalName }} · {{ org.legalForm }}</p>
          </div>
          <div class="badges">
            <app-status-pill [status]="statusUi()" />
            <app-status-pill [status]="payoutUi()" />
            @if (org.vatNumber) {
              <keijo-pill variant="default" [icon]="orgIcon">P. IVA {{ org.vatNumber }}</keijo-pill>
            }
          </div>
        </div>

        @if (options().length > 1) {
          <keijo-select
            [formControl]="picker"
            [data]="options()"
            label="organizzazione"
            placeholder="Scegli l’organizzazione"
            (onSelectionChange)="onPick()"
          />
        }

        <nav class="links">
          @for (link of links; track link.id) {
            <keijo-navigation-button
              variant="row"
              [label]="link.label"
              [leadingIcon]="link.icon"
              [trailingIcon]="current() === link.id ? undefined : chevronIcon"
              [disabled]="current() === link.id"
              (action)="go(link.path)"
            />
          }
        </nav>
      </keijo-page-section-wrapper>
    }
  `,
  styles: [
    `
      .head {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        justify-content: space-between;
        align-items: flex-start;
      }
      .title {
        font-size: 1.05rem;
        font-weight: 600;
        margin: 0;
      }
      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
      }
      .links {
        display: grid;
        gap: 0.375rem;
        grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
      }
    `,
  ],
})
export class OrganizationContextComponent {
  private readonly router = inject(Router);
  private readonly store = inject(OrganizationStore);

  readonly current = input<string>('');
  /** Emesso quando l'utente cambia organizzazione: la pagina ricarica i suoi dati. */
  readonly picker = new FormControl<number | null>(null);

  readonly chevronIcon = chevronRight;
  readonly orgIcon = domain;

  readonly organization = computed(() => this.store.current());

  readonly options = computed<SelectOption[]>(() =>
    this.store.items().map((o) => ({ label: o.name, value: o.id })),
  );

  readonly statusUi = computed(() => {
    const org = this.store.current();
    return org ? ORGANIZATION_STATUS_UI[org.status] : null;
  });

  readonly payoutUi = computed(() => {
    const org = this.store.current();
    return org ? PAYOUT_STATUS_UI[org.payoutStatus] : null;
  });

  readonly links = [
    { id: 'profile', label: 'Anagrafica', icon: domain, path: '/organization' },
    { id: 'payout', label: 'Incasso', icon: payments, path: '/organization/payout' },
    { id: 'fiscal', label: 'Dichiarazioni', icon: description, path: '/organization/fiscal' },
    { id: 'members', label: 'Membri', icon: groups, path: '/organization/members' },
    {
      id: 'refund-policies',
      label: 'Policy di rimborso',
      icon: percent,
      path: '/organization/refund-policies',
    },
  ];

  async onPick(): Promise<void> {
    const id = this.picker.value;
    if (id) await this.store.loadOne(Number(id));
  }

  go(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
