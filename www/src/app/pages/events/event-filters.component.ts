import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DanceRole, PublicEventQuery } from '../../core/domain/models';

/**
 * I filtri della ricerca pubblica — `query` del §3.7, elenco chiuso.
 *
 * Tre cose che l'interfaccia **spiega** invece di lasciarle indovinare:
 *
 *  - il **ruolo di ballo** non è un dettaglio anagrafico: restringe agli eventi
 *    che hanno ancora capienza *per quel ruolo*. Un evento pieno di follower e
 *    aperto ai leader deve comparire a un leader e sparire a una follower;
 *  - le **date** filtrano sulla **sovrapposizione** con l'evento, non sul suo
 *    inizio: un festival di quattro settimane già cominciato compare lo stesso;
 *  - **regione** è un elenco chiuso perché il backend la deriva dalla sigla di
 *    provincia: un campo libero produrrebbe «Puglia», «PUGLIA» e «Apulia» come
 *    tre regioni diverse (§3.4).
 */

/** Le venti regioni italiane, nella grafia con cui il backend le deriva (§3.4). */
const REGIONI = [
  'Abruzzo',
  'Basilicata',
  'Calabria',
  'Campania',
  'Emilia-Romagna',
  'Friuli-Venezia Giulia',
  'Lazio',
  'Liguria',
  'Lombardia',
  'Marche',
  'Molise',
  'Piemonte',
  'Puglia',
  'Sardegna',
  'Sicilia',
  'Toscana',
  'Trentino-Alto Adige',
  'Umbria',
  "Valle d'Aosta",
  'Veneto',
];

@Component({
  selector: 'app-event-filters',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="filters www-panel" (ngSubmit)="submit()" role="search" aria-label="Cerca eventi">
      <div class="row">
        <div class="www-field grow">
          <label class="www-label" for="f-value">Cerca</label>
          <input
            id="f-value"
            class="www-input"
            type="search"
            name="value"
            [(ngModel)]="value"
            placeholder="Titolo, descrizione, maestri, DJ, location…"
            autocomplete="off"
          />
        </div>

        <div class="www-field">
          <label class="www-label" for="f-city">Città</label>
          <input id="f-city" class="www-input" type="text" name="city" [(ngModel)]="city" placeholder="Trani" />
        </div>

        <div class="www-field small">
          <label class="www-label" for="f-province">Provincia</label>
          <input
            id="f-province"
            class="www-input"
            type="text"
            name="province"
            maxlength="2"
            [(ngModel)]="province"
            placeholder="BT"
            style="text-transform: uppercase"
          />
        </div>

        <div class="www-field">
          <label class="www-label" for="f-region">Regione</label>
          <select id="f-region" class="www-select" name="region" [(ngModel)]="region">
            <option value="">Tutte le regioni</option>
            @for (r of regioni; track r) {
              <option [value]="r">{{ r }}</option>
            }
          </select>
        </div>
      </div>

      <div class="row">
        <div class="www-field">
          <label class="www-label" for="f-from">Dal</label>
          <input id="f-from" class="www-input" type="date" name="from" [(ngModel)]="from" />
        </div>
        <div class="www-field">
          <label class="www-label" for="f-to">Al</label>
          <input id="f-to" class="www-input" type="date" name="to" [(ngModel)]="to" />
        </div>

        <div class="www-field grow">
          <label class="www-label" for="f-role">Il tuo ruolo di ballo</label>
          <select id="f-role" class="www-select" name="role" [(ngModel)]="role">
            <option value="">Indifferente — mostrami tutto</option>
            <option value="LEADER">Leader — solo eventi con posti leader</option>
            <option value="FOLLOWER">Follower — solo eventi con posti follower</option>
          </select>
        </div>

        <div class="actions">
          <button type="submit" class="www-btn">Cerca</button>
          <button type="button" class="www-btn www-btn-secondary" (click)="clear()">Azzera</button>
        </div>
      </div>

      <p class="www-hint">
        <strong>Date:</strong> mostriamo gli <em>eventi in corso o in programma fra queste date</em>,
        non solo quelli che cominciano in questo intervallo — un festival di quattro settimane
        compare anche se è già iniziato.
      </p>
      <p class="www-hint">
        <strong>Ruolo di ballo:</strong> nel tango la capienza è divisa fra leader e follower, e i
        due contatori sono indipendenti dal genere della persona. Scegliendo il tuo ruolo restano
        solo gli eventi che hanno ancora posto <em>per te</em>: un evento pieno di follower e ancora
        aperto ai leader compare a un leader e non a una follower.
      </p>
    </form>
  `,
  styles: [
    `
      .filters {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: flex-end;
      }
      .www-field {
        min-width: 9rem;
      }
      .www-field.grow {
        flex: 1 1 16rem;
      }
      .www-field.small {
        max-width: 7rem;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        margin-left: auto;
      }
      .www-hint {
        margin: 0;
      }
    `,
  ],
})
export class EventFiltersComponent {
  readonly initial = input<PublicEventQuery>({});
  readonly changed = output<PublicEventQuery>();

  protected readonly regioni = REGIONI;

  protected value = '';
  protected city = '';
  protected province = '';
  protected region = '';
  protected from = '';
  protected to = '';
  protected role: '' | DanceRole = '';

  private readonly hydrated = signal(false);

  ngOnInit(): void {
    if (this.hydrated()) return;
    const q = this.initial();
    this.value = q.value ?? '';
    this.city = q.city ?? '';
    this.province = q.province ?? '';
    this.region = q.region ?? '';
    this.from = q.from ? q.from.slice(0, 10) : '';
    this.to = q.to ? q.to.slice(0, 10) : '';
    this.role = q.role ?? '';
    this.hydrated.set(true);
  }

  protected submit(): void {
    this.changed.emit(this.build());
  }

  protected clear(): void {
    this.value = this.city = this.province = this.region = this.from = this.to = '';
    this.role = '';
    this.changed.emit({});
  }

  private build(): PublicEventQuery {
    const q: PublicEventQuery = {};
    if (this.value.trim()) q.value = this.value.trim();
    if (this.city.trim()) q.city = this.city.trim();
    if (this.province.trim()) q.province = this.province.trim().toUpperCase();
    if (this.region) q.region = this.region;
    // Il giorno «al» si estende a fine giornata: chi scrive 30 giugno intende
    // tutto il 30 giugno, non le 00:00 del 30.
    if (this.from) q.from = new Date(`${this.from}T00:00:00`).toISOString();
    if (this.to) q.to = new Date(`${this.to}T23:59:59`).toISOString();
    if (this.role) q.role = this.role;
    return q;
  }
}
