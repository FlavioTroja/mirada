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
            <!--
              La scheda corrente NON è disabilitata: è corrente.

              Prima la voce attiva veniva passata come disabilitata, e la
              conseguenza era che la pagina in cui ti trovi diventava la meno
              visibile del gruppo invece della più visibile — attenuata come un
              comando inerte. Non era solo un problema di colore: la toglieva
              dal giro della tastiera e la faceva annunciare come «non
              disponibile» invece che come «pagina corrente».

              aria-current="page" è ciò che quello stato significa davvero, e la
              classe is-current gli dà il risalto che gli spetta.
            -->
            <keijo-navigation-button
              variant="row"
              class="link"
              [class.is-current]="current() === link.id"
              [attr.aria-current]="current() === link.id ? 'page' : null"
              [label]="link.label"
              [leadingIcon]="link.icon"
              [trailingIcon]="current() === link.id ? undefined : chevronIcon"
              (action)="go(link.path, link.id)"
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
      /* Il bordo sta su TUTTE e cinque, non solo sulla corrente, e per due
         ragioni distinte.

         La prima è che il pulsante di serie nasce senza bordo e con il fondo
         uguale alla superficie della card — misurano 1,07:1 fra loro. Le voci
         non selezionate erano quindi tono su tono e si confondevano con la
         pagina: un comando deve avere un confine (1.4.11).

         La seconda è geometrica, ed era un difetto che avevo introdotto io: il
         pulsante della libreria usa box-sizing border-box ma NON ha un'altezza
         fissa, quindi un bordo messo alla sola voce corrente le aggiungeva 2px
         di altezza e la fila si spostava a ogni cambio di scheda. Con il bordo
         su tutte, l'ingombro non cambia mai: cambia solo il colore. */
      .link ::ng-deep button {
        border: 1px solid rgba(var(--text-rgb), 0.55) !important; /* 5,3 · 4,0:1 */
      }

      /* La voce corrente si riconosce **senza dipendere dal colore**: bordo
         d'accento e testo in grassetto. Chi non distingue i colori vede
         comunque quale delle cinque è quella aperta (1.4.1). */
      .link.is-current ::ng-deep button {
        border-color: rgb(var(--accent-rgb)) !important;
        background: rgba(var(--accent-rgb), 0.14) !important;
        font-weight: 600;
      }
      .link.is-current ::ng-deep button,
      .link.is-current ::ng-deep button * {
        color: rgb(var(--text-rgb)) !important;
        opacity: 1 !important;
      }
      /* auto-fit, non auto-fill — ed è la differenza fra i due che spiegava
         l'altezza ballerina.

         Con auto-fill il browser crea tutte le colonne che ci stanno, anche
         quelle senza contenuto: su uno schermo largo 1641px ne generava SETTE
         per CINQUE voci. Le due colonne fantasma si prendevano il loro spazio,
         le altre restavano a 229px, e a quella larghezza «Policy di rimborso»
         andava a capo su due righe. In una griglia una cella alta alza tutta la
         riga: le voci diventavano 74px invece di 50. Sull'altra pagina la
         colonna era 2px più larga, l'etichetta ci stava, e l'altezza cambiava
         sotto gli occhi passando da una scheda all'altra.

         auto-fit fa collassare le tracce vuote: le cinque voci si dividono
         tutta la larghezza, nessuna etichetta va più a capo, e l'altezza non
         dipende più da dove ti trovi. */
      .links {
        display: grid;
        gap: 0.375rem;
        grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
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

  /**
   * La voce corrente resta premibile — è così che smette di essere annunciata
   * come «non disponibile» — ma premerla non ricarica la pagina su cui sei già:
   * sarebbe una navigazione a vuoto che azzera lo stato di un modulo aperto.
   */
  go(path: string, id: string): void {
    if (this.current() === id) return;
    void this.router.navigateByUrl(path);
  }
}
