import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DanceRole, PublicEventQuery } from '../../core/domain/models';

/**
 * I filtri della ricerca pubblica — `query` del §3.7, elenco chiuso.
 *
 * ## La forma, e perché
 *
 * In vista resta **solo la barra di ricerca**. Gli altri filtri — dove, quando,
 * ruolo — stanno in un pannello che si apre su richiesta, con le sezioni
 * elencate **a sinistra** e i campi a destra: è il modo di lavorare del
 * componente `cerca` di keijo, portato qui nello stile di `www` (che non ha la
 * shell keijo e non ne importa i componenti).
 *
 * Il pannello è chiuso all'inizio perché la stragrande maggioranza delle
 * ricerche è una parola in un campo. Chi ha bisogno di restringere lo chiede.
 *
 * ## Ciò che il pannello chiuso NON deve nascondere
 *
 * Un filtro attivo e invisibile è il difetto classico di questa interfaccia:
 * l'elenco mostra pochi eventi, la ragione è chiusa dentro un pannello, e chi
 * guarda conclude che di eventi non ce ne sono. Per questo i filtri attivi
 * restano **sempre in vista come pastiglie**, ognuna con la propria croce, e il
 * bottone del pannello porta il loro numero.
 *
 * Vale doppio qui, perché i filtri vivono nella query string: un indirizzo
 * mandato a un'amica arriva già filtrato, e lei non ha visto nessuno impostarli.
 *
 * ## Tre cose che l'interfaccia spiega invece di lasciarle indovinare
 *
 *  - il **ruolo di ballo** non è un dettaglio anagrafico: restringe agli eventi
 *    che hanno ancora capienza *per quel ruolo*. Un evento pieno di follower e
 *    aperto ai leader deve comparire a un leader e sparire a una follower;
 *  - le **date** filtrano sulla **sovrapposizione** con l'evento, non sul suo
 *    inizio: un festival di quattro settimane già cominciato compare lo stesso;
 *  - **regione** è un elenco chiuso perché il backend la deriva dalla sigla di
 *    provincia: un campo libero produrrebbe «Puglia», «PUGLIA» e «Apulia» come
 *    tre regioni diverse (§3.4).
 *
 * Quelle spiegazioni stanno **dentro la sezione che le riguarda**, non tutte in
 * fondo: prima erano due paragrafi sotto il modulo, e chi compilava le date non
 * li leggeva perché parlavano anche d'altro.
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

/** Una pastiglia di filtro attivo: cosa mostrare, e cosa togliere se la si chiude. */
interface FiltroAttivo {
  readonly campo: 'city' | 'province' | 'region' | 'from' | 'to' | 'role';
  readonly etichetta: string;
}

type Sezione = 'dove' | 'quando' | 'ruolo';

@Component({
  selector: 'app-event-filters',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="cerca www-panel" (ngSubmit)="submit()" role="search" aria-label="Cerca eventi">
      <!-- ── La barra, sempre in vista ─────────────────────────────────── -->
      <div class="barra">
        <div class="campo-cerca">
          <span class="lente" aria-hidden="true">⌕</span>
          <input
            id="f-value"
            class="www-input"
            type="search"
            name="value"
            [(ngModel)]="value"
            placeholder="Titolo, descrizione, maestri, DJ, location…"
            autocomplete="off"
            aria-label="Cerca fra gli eventi"
          />
        </div>

        <!-- 'aria-expanded' e 'aria-controls' non sono decorativi: senza, chi
             usa uno screen reader sente un bottone che non dice se il pannello
             che governa è aperto, né quale sia. -->
        <button
          type="button"
          class="www-btn www-btn-secondary bottone-filtri"
          [class.acceso]="attivi().length > 0"
          [attr.aria-expanded]="aperto()"
          aria-controls="pannello-filtri"
          (click)="apri.set(!aperto())"
        >
          Filtri
          @if (attivi().length > 0) {
            <span class="conteggio">{{ attivi().length }}</span>
          }
        </button>

        <button type="submit" class="www-btn">Cerca</button>
      </div>

      <!-- ── I filtri attivi, anche a pannello chiuso ───────────────────── -->
      @if (attivi().length > 0) {
        <ul class="pastiglie" aria-label="Filtri attivi">
          @for (f of attivi(); track f.campo) {
            <li>
              <span class="www-chip www-chip-accent pastiglia">
                {{ f.etichetta }}
                <button
                  type="button"
                  class="togli"
                  [attr.aria-label]="'Togli il filtro ' + f.etichetta"
                  (click)="togli(f.campo)"
                >
                  ✕
                </button>
              </span>
            </li>
          }
          <li>
            <button type="button" class="azzera-tutto" (click)="clear()">Azzera tutti</button>
          </li>
        </ul>
      }

      <!-- ── Il pannello ───────────────────────────────────────────────── -->
      @if (aperto()) {
        <div class="pannello" id="pannello-filtri">
          <!-- Le sezioni a sinistra. 'tablist' e non una lista di bottoni
               qualsiasi: così le frecce della tastiera si comportano come chi
               le usa si aspetta. -->
          <div class="sezioni" role="tablist" aria-orientation="vertical" aria-label="Sezioni dei filtri">
            @for (s of sezioni; track s.id) {
              <button
                type="button"
                role="tab"
                class="sezione"
                [class.scelta]="sezione() === s.id"
                [attr.aria-selected]="sezione() === s.id"
                [attr.aria-controls]="'sezione-' + s.id"
                [id]="'tab-' + s.id"
                (click)="sezione.set(s.id)"
              >
                {{ s.nome }}
                @if (contaSezione(s.id) > 0) {
                  <span class="pallino" [attr.aria-label]="contaSezione(s.id) + ' filtri attivi'"></span>
                }
              </button>
            }
          </div>

          <div class="campi">
            @switch (sezione()) {
              @case ('dove') {
                <div role="tabpanel" id="sezione-dove" aria-labelledby="tab-dove" class="riga">
                  <div class="www-field grow">
                    <label class="www-label" for="f-city">Città</label>
                    <input
                      id="f-city"
                      class="www-input"
                      type="text"
                      name="city"
                      [(ngModel)]="city"
                      placeholder="Trani"
                    />
                  </div>

                  <div class="www-field piccolo">
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

                  <div class="www-field grow">
                    <label class="www-label" for="f-region">Regione</label>
                    <select id="f-region" class="www-select" name="region" [(ngModel)]="region">
                      <option value="">Tutte le regioni</option>
                      @for (r of regioni; track r) {
                        <option [value]="r">{{ r }}</option>
                      }
                    </select>
                  </div>
                </div>
              }

              @case ('quando') {
                <div role="tabpanel" id="sezione-quando" aria-labelledby="tab-quando">
                  <div class="riga">
                    <div class="www-field">
                      <label class="www-label" for="f-from">Dal</label>
                      <input id="f-from" class="www-input" type="date" name="from" [(ngModel)]="from" />
                    </div>
                    <div class="www-field">
                      <label class="www-label" for="f-to">Al</label>
                      <input id="f-to" class="www-input" type="date" name="to" [(ngModel)]="to" />
                    </div>
                  </div>
                  <p class="www-hint">
                    Mostriamo gli <em>eventi in corso o in programma fra queste date</em>, non solo
                    quelli che cominciano nell'intervallo: un festival di quattro settimane compare
                    anche se è già iniziato.
                  </p>
                </div>
              }

              @case ('ruolo') {
                <div role="tabpanel" id="sezione-ruolo" aria-labelledby="tab-ruolo">
                  <div class="riga">
                    <div class="www-field grow">
                      <label class="www-label" for="f-role">Il tuo ruolo di ballo</label>
                      <select id="f-role" class="www-select" name="role" [(ngModel)]="role">
                        <option value="">Indifferente — mostrami tutto</option>
                        <option value="LEADER">Leader — solo eventi con posti leader</option>
                        <option value="FOLLOWER">Follower — solo eventi con posti follower</option>
                      </select>
                    </div>
                  </div>
                  <p class="www-hint">
                    Nel tango la capienza è divisa fra leader e follower, e i due contatori sono
                    indipendenti dal genere della persona. Scegliendo il tuo ruolo restano solo gli
                    eventi che hanno ancora posto <em>per te</em>: un evento pieno di follower e
                    ancora aperto ai leader compare a un leader e non a una follower.
                  </p>
                </div>
              }
            }

            <div class="azioni">
              <button type="button" class="www-btn www-btn-secondary" (click)="clear()">Azzera</button>
              <button type="submit" class="www-btn">Applica</button>
            </div>
          </div>
        </div>
      }
    </form>
  `,
  styles: [
    `
      .cerca {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      /* ── La barra ─────────────────────────────────────────────────── */
      .barra {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .campo-cerca {
        position: relative;
        flex: 1 1 auto;
        min-width: 0;
      }
      .campo-cerca .www-input {
        padding-left: 2.1rem;
        width: 100%;
      }
      .lente {
        position: absolute;
        left: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 1.15rem;
        line-height: 1;
        color: rgba(var(--text-rgb), 0.5);
        pointer-events: none;
      }
      .bottone-filtri {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        white-space: nowrap;
      }
      .bottone-filtri.acceso {
        border-color: rgba(var(--accent-rgb), 0.6);
      }
      .conteggio {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.25rem;
        height: 1.25rem;
        padding: 0 0.35rem;
        border-radius: 999px;
        background: rgb(var(--accent-rgb));
        color: rgb(var(--foreground-color));
        font-size: 0.72rem;
        font-weight: 700;
      }

      /* ── Le pastiglie dei filtri attivi ───────────────────────────── */
      .pastiglie {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .pastiglia {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
      .togli {
        border: 0;
        background: transparent;
        padding: 0 0 0 0.1rem;
        cursor: pointer;
        color: inherit;
        font-size: 0.85em;
        line-height: 1;
        opacity: 0.7;
      }
      .togli:hover {
        opacity: 1;
      }
      .azzera-tutto {
        border: 0;
        background: transparent;
        padding: 0;
        cursor: pointer;
        font-size: 0.82rem;
        color: rgba(var(--text-rgb), 0.7);
        text-decoration: underline;
      }
      .azzera-tutto:hover {
        color: rgb(var(--text-rgb));
      }

      /* ── Il pannello ──────────────────────────────────────────────── */
      .pannello {
        display: grid;
        grid-template-columns: 11rem 1fr;
        gap: 1rem;
        padding-top: 0.75rem;
        border-top: 1px solid rgba(var(--text-rgb), 0.14);
      }
      .sezioni {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
      .sezione {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        text-align: left;
        border: 0;
        background: transparent;
        padding: 0.5rem 0.65rem;
        border-radius: var(--www-radius);
        cursor: pointer;
        color: rgba(var(--text-rgb), 0.8);
        font-size: 0.92rem;
      }
      .sezione:hover {
        background: rgba(var(--text-rgb), 0.06);
      }
      .sezione.scelta {
        background: rgba(var(--accent-rgb), 0.12);
        color: rgb(var(--text-rgb));
        font-weight: 600;
      }
      .pallino {
        width: 0.45rem;
        height: 0.45rem;
        border-radius: 999px;
        background: rgb(var(--accent-rgb));
      }
      .campi {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: 0;
      }
      .riga {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: flex-end;
      }
      .www-field {
        min-width: 9rem;
      }
      .www-field.grow {
        flex: 1 1 12rem;
      }
      .www-field.piccolo {
        max-width: 7rem;
      }
      .www-hint {
        margin: 0;
      }
      .azioni {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
        margin-top: auto;
      }

      @media (max-width: 640px) {
        .barra {
          flex-wrap: wrap;
        }
        .campo-cerca {
          flex: 1 1 100%;
        }
        /* Sotto i 640px le sezioni tornano in orizzontale: una colonna da 11rem
           accanto ai campi lascerebbe a questi ultimi meno spazio di quanto un
           campo data ne richieda, e le due date andrebbero a capo una per riga. */
        .pannello {
          grid-template-columns: 1fr;
        }
        .sezioni {
          flex-direction: row;
          flex-wrap: wrap;
        }
      }
    `,
  ],
})
export class EventFiltersComponent {
  readonly initial = input<PublicEventQuery>({});
  readonly changed = output<PublicEventQuery>();

  protected readonly regioni = REGIONI;

  protected readonly sezioni: ReadonlyArray<{ id: Sezione; nome: string }> = [
    { id: 'dove', nome: 'Dove' },
    { id: 'quando', nome: 'Quando' },
    { id: 'ruolo', nome: 'Ruolo' },
  ];

  protected value = '';
  protected city = '';
  protected province = '';
  protected region = '';
  protected from = '';
  protected to = '';
  protected role: '' | DanceRole = '';

  protected readonly sezione = signal<Sezione>('dove');

  /** Aperto a mano dall'utente. Vedi 'aperto()'. */
  protected readonly apri = signal(false);

  private readonly hydrated = signal(false);

  /**
   * Le pastiglie si calcolano da 'initial()', cioè da ciò che è **davvero in
   * vigore** nella query string — non dai campi del modulo.
   *
   * La differenza conta: i campi cambiano a ogni battuta di tasto, e mostrare
   * lì «Puglia» prima che qualcuno prema *Applica* direbbe che l'elenco sotto è
   * filtrato per Puglia mentre non lo è ancora.
   */
  protected readonly attivi = computed<FiltroAttivo[]>(() => {
    const q = this.initial();
    const out: FiltroAttivo[] = [];
    if (q.city) out.push({ campo: 'city', etichetta: q.city });
    if (q.province) out.push({ campo: 'province', etichetta: `Provincia ${q.province}` });
    if (q.region) out.push({ campo: 'region', etichetta: q.region });
    if (q.from) out.push({ campo: 'from', etichetta: `dal ${giorno(q.from)}` });
    if (q.to) out.push({ campo: 'to', etichetta: `al ${giorno(q.to)}` });
    if (q.role) {
      out.push({ campo: 'role', etichetta: q.role === 'LEADER' ? 'Posti leader' : 'Posti follower' });
    }
    return out;
  });

  /**
   * Il pannello è aperto se l'utente l'ha aperto.
   *
   * NON si apre da sé quando arrivano filtri dalla query string, anche se la
   * tentazione è forte: chi apre un indirizzo condiviso vuole vedere *i
   * risultati*, e un pannello aperto glieli spinge sotto la piega. Che dei
   * filtri ci siano lo dicono le pastiglie, che restano in vista.
   */
  protected readonly aperto = computed(() => this.apri());

  ngOnInit(): void {
    if (this.hydrated()) return;
    this.riempi(this.initial());
    this.hydrated.set(true);
  }

  /** Quanti filtri attivi ricadono in una sezione: alimenta il pallino. */
  protected contaSezione(s: Sezione): number {
    const campi: Record<Sezione, ReadonlyArray<FiltroAttivo['campo']>> = {
      dove: ['city', 'province', 'region'],
      quando: ['from', 'to'],
      ruolo: ['role'],
    };
    return this.attivi().filter((f) => campi[s].includes(f.campo)).length;
  }

  protected submit(): void {
    this.changed.emit(this.build());
  }

  /**
   * Toglie un filtro dalla pastiglia. Emette **subito**, senza aspettare
   * *Applica*: una croce che non fa niente finché non si preme un altro bottone
   * è una croce rotta.
   */
  protected togli(campo: FiltroAttivo['campo']): void {
    switch (campo) {
      case 'city':
        this.city = '';
        break;
      case 'province':
        this.province = '';
        break;
      case 'region':
        this.region = '';
        break;
      case 'from':
        this.from = '';
        break;
      case 'to':
        this.to = '';
        break;
      case 'role':
        this.role = '';
        break;
    }
    this.changed.emit(this.build());
  }

  protected clear(): void {
    this.value = this.city = this.province = this.region = this.from = this.to = '';
    this.role = '';
    this.changed.emit({});
  }

  private riempi(q: PublicEventQuery): void {
    this.value = q.value ?? '';
    this.city = q.city ?? '';
    this.province = q.province ?? '';
    this.region = q.region ?? '';
    this.from = q.from ? q.from.slice(0, 10) : '';
    this.to = q.to ? q.to.slice(0, 10) : '';
    this.role = q.role ?? '';
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

/** «2026-09-12T00:00:00.000Z» → «12 set». Per le pastiglie, dove lo spazio è poco. */
function giorno(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}
