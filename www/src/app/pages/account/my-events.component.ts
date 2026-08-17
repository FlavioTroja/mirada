import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyRegistrationsService } from '../../core/auth/my-registrations.service';
import { MyRegistration, MyTicket } from '../../core/domain/models';
import { dateRange } from '../../core/format/format';
import { I18nTextComponent } from '../../shared/i18n-text.component';

/** Le etichette di stato dell'iscrizione, dette a chi si è iscritto. */
const REGISTRATION_STATUS: Record<string, { label: string; tone: string }> = {
  CONFIRMED: { label: 'Iscrizione confermata', tone: 'www-chip-ok' },
  // `TO_CONFIRM` **non blocca l'ingresso** (`RF-CPL-13`): il biglietto è valido
  // lo stesso, e il testo non deve far credere il contrario.
  TO_CONFIRM: { label: 'Da confermare', tone: 'www-chip-warn' },
  DECLINED: { label: 'Rifiutata', tone: 'www-chip-off' },
  CANCELLED: { label: 'Annullata', tone: 'www-chip-off' },
};

const ROLE_LABEL: Record<string, string> = {
  LEADER: 'Leader',
  FOLLOWER: 'Follower',
  FLEXIBLE: 'Ruolo flessibile',
};

const TICKET_STATUS: Record<string, { label: string; tone: string }> = {
  VALID: { label: 'Valido', tone: 'www-chip-ok' },
  CANCELLED: { label: 'Annullato', tone: 'www-chip-off' },
  REFUNDED: { label: 'Rimborsato', tone: 'www-chip-off' },
  TRANSFERRED: { label: 'Trasferito', tone: 'www-chip-off' },
};

/**
 * **I tuoi eventi** — le iscrizioni di chi guarda, con i relativi biglietti.
 *
 * ── Il QR si apre, non si stampa in pagina ───────────────────────────────────
 * Le immagini si caricano una per volta, al clic. Non è pigrizia di rete: un
 * QR è la chiave d'ingresso di una persona, e tenerne quattro aperti su uno
 * schermo in una sala piena è il modo più semplice per farsene fotografare uno
 * da dietro. Si apre quello che serve, quando serve.
 *
 * ── Perché i passati restano ─────────────────────────────────────────────────
 * Un evento a cui si è stati non è un residuo da nascondere: è la propria
 * storia di ballerino, ed è il primo posto dove si va a cercare «come si
 * chiamava quel festival dell'anno scorso».
 */
@Component({
  selector: 'app-my-events',
  imports: [RouterLink, I18nTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="www-panel">
      <h2 class="www-h2">{{ title() }}</h2>

      @if (rows().length === 0) {
        <p class="www-hint">{{ emptyLabel() }}</p>
      } @else {
        <ul class="cards">
          @for (reg of rows(); track reg.id) {
            <li class="card">
              <a class="poster" [routerLink]="['/eventi', reg.event.slug]">
                @if (reg.event.posterUrl) {
                  <img [src]="reg.event.posterUrl" alt="" loading="lazy" />
                } @else {
                  <span class="poster-empty" aria-hidden="true">◆</span>
                }
              </a>

              <div class="body">
                <a class="name" [routerLink]="['/eventi', reg.event.slug]">
                  <app-i18n-text [value]="reg.event.title" [showLanguage]="false" />
                </a>
                <p class="when">{{ when(reg) }}</p>
                @if (reg.event.venueName || reg.event.city) {
                  <p class="where">
                    {{ reg.event.venueName }}@if (reg.event.venueName && reg.event.city) {
                      <span> · </span>
                    }{{ reg.event.city }}
                  </p>
                }

                <div class="chips">
                  <span class="www-chip" [class]="'www-chip ' + statusTone(reg)">{{
                    statusLabel(reg)
                  }}</span>
                  @if (roleLabel(reg); as role) {
                    <span class="www-chip">{{ role }}</span>
                  }
                </div>

                @if (reg.tickets.length === 0) {
                  <p class="www-hint">
                    Nessun biglietto ancora emesso per questa iscrizione. Arriva per email appena
                    l’organizzatore la conferma.
                  </p>
                } @else {
                  <ul class="tickets">
                    @for (t of reg.tickets; track t.id) {
                      <li class="ticket">
                        <div class="ticket-head">
                          <span class="ticket-name">
                            <app-i18n-text
                              [value]="t.ticketTypeName"
                              [showLanguage]="false"
                              emptyLabel="Titolo d’ingresso"
                            />
                          </span>
                          <span class="www-chip" [class]="'www-chip ' + ticketTone(t)">{{
                            ticketLabel(t)
                          }}</span>
                          @if (t.bearer) {
                            <span class="www-chip">Al portatore</span>
                          }
                        </div>
                        <p class="holder">Intestato a {{ t.holderName }} {{ t.holderSurname }}</p>

                        @if (!past()) {
                          @if (!t.qrAvailable) {
                            <p class="www-hint">
                              Il QR di questo biglietto non è più valido: è stato revocato con il
                              rimborso o con l’annullamento.
                            </p>
                          } @else if (openQr() === t.id) {
                            @if (qrSrc(); as src) {
                              <figure class="qr">
                                <img [src]="src" alt="Codice QR del tuo biglietto" />
                                <figcaption class="www-hint">
                                  Mostralo all’ingresso. Vale solo per questo biglietto.
                                </figcaption>
                              </figure>
                              <button type="button" class="www-btn www-btn-secondary" (click)="closeQr()">
                                Nascondi il QR
                              </button>
                            } @else if (qrError()) {
                              <p class="www-hint">{{ qrError() }}</p>
                            } @else {
                              <p class="www-hint">Un momento…</p>
                            }
                          } @else {
                            <button
                              type="button"
                              class="www-btn www-btn-secondary"
                              (click)="showQr(t.id)"
                            >
                              Mostra il QR
                            </button>
                          }
                        }
                      </li>
                    }
                  </ul>
                }
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .www-panel > .www-h2 {
        margin-top: 0;
      }
      .cards {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 1rem;
      }
      .card {
        display: flex;
        gap: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--www-line);
      }
      .card:first-child {
        padding-top: 0;
        border-top: 0;
      }
      .poster {
        flex: none;
        width: 4.5rem;
        height: 6.75rem;
        border-radius: var(--www-radius-sm);
        overflow: hidden;
        border: 1px solid var(--www-line);
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--www-panel);
        color: rgb(var(--accent-rgb));
        text-decoration: none;
      }
      .poster img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .body {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .name {
        font-size: 1.05rem;
        font-weight: 600;
        color: rgb(var(--text-rgb));
        text-decoration: none;
      }
      .name:hover {
        color: rgb(var(--accent-rgb));
      }
      .when,
      .where,
      .holder {
        margin: 0;
        color: rgba(var(--text-rgb), 0.72);
        font-size: 0.9rem;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-top: 0.15rem;
      }
      .tickets {
        list-style: none;
        margin: 0.6rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.6rem;
      }
      .ticket {
        border: 1px solid var(--www-line);
        border-radius: var(--www-radius-sm);
        padding: 0.6rem 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        align-items: flex-start;
      }
      .ticket-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem;
      }
      .ticket-name {
        font-weight: 600;
      }
      .qr {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        align-items: flex-start;
      }
      .qr img {
        /* Il PNG è 800px per essere nitido su schermi a densità doppia: qui si
           mostra piccolo, perché è un lettore a doverlo leggere, non una
           persona. */
        width: 12rem;
        height: 12rem;
        border-radius: var(--www-radius-sm);
        background: #fff;
      }
      @media (max-width: 640px) {
        .poster {
          width: 3.5rem;
          height: 5.25rem;
        }
      }
    `,
  ],
})
export class MyEventsComponent {
  private readonly service = inject(MyRegistrationsService);

  readonly rows = input.required<MyRegistration[]>();
  readonly title = input.required<string>();
  readonly emptyLabel = input.required<string>();
  /** Sui passati il QR non si offre: non apre più niente. */
  readonly past = input<boolean>(false);

  protected readonly openQr = signal<number | null>(null);
  protected readonly qrSrc = signal<string | null>(null);
  protected readonly qrError = signal<string | null>(null);

  protected when(reg: MyRegistration): string {
    return dateRange(reg.event.startAt, reg.event.endAt);
  }

  protected statusLabel(reg: MyRegistration): string {
    return REGISTRATION_STATUS[reg.status]?.label ?? reg.status;
  }

  protected statusTone(reg: MyRegistration): string {
    return REGISTRATION_STATUS[reg.status]?.tone ?? '';
  }

  /**
   * Il ruolo **assegnato** quando c'è, quello dichiarato quando ancora manca:
   * sono due cose diverse e il secondo non va spacciato per il primo — chi ha
   * dichiarato «flessibile» non sa ancora cosa ballerà.
   */
  protected roleLabel(reg: MyRegistration): string | null {
    if (reg.assignedRole) return ROLE_LABEL[reg.assignedRole] ?? reg.assignedRole;
    if (reg.declaredRole === 'FLEXIBLE') return 'Ruolo non ancora assegnato';
    return ROLE_LABEL[reg.declaredRole] ?? null;
  }

  protected ticketLabel(t: MyTicket): string {
    return TICKET_STATUS[t.status]?.label ?? t.status;
  }

  protected ticketTone(t: MyTicket): string {
    return TICKET_STATUS[t.status]?.tone ?? '';
  }

  protected async showQr(ticketId: number): Promise<void> {
    this.closeQr();
    this.openQr.set(ticketId);
    try {
      this.qrSrc.set(await this.service.qrUrl(ticketId));
    } catch {
      this.qrError.set('Il QR non è disponibile in questo momento. Riprova fra poco.');
    }
  }

  protected closeQr(): void {
    const src = this.qrSrc();
    // L'URL di oggetto tiene in vita l'immagine finché non lo si revoca: senza
    // questo, aprire e chiudere dieci QR lascerebbe dieci immagini in memoria.
    if (src) URL.revokeObjectURL(src);
    this.qrSrc.set(null);
    this.qrError.set(null);
    this.openQr.set(null);
  }
}
