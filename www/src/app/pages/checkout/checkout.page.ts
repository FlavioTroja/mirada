import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EventStore } from '../../stores/event.store';
import { OrderStore } from '../../stores/order.store';
import { AuthService } from '../../core/auth/auth.service';
import { SeoService } from '../../core/seo/seo.service';
import { DeclaredDanceRole, OrderAttendee, PublicTicketType } from '../../core/domain/models';
import { money, text } from '../../core/format/format';
import { AccountStepComponent } from './account-step.component';
import { ReservationCountdownComponent } from './reservation-countdown.component';
import { I18nTextComponent } from '../../shared/i18n-text.component';

/**
 * `/eventi/:slug/iscrizione` — l'iscrizione **senza pagamento**.
 *
 *  1. serve un account: `POST /api/users/register` oppure `POST /api/auth/login`;
 *  2. `POST /api/orders/reserve` → prenotazione di **15 minuti**, con il conto
 *     alla rovescia sempre visibile (`RF-PAY-20`);
 *  3. `POST /api/orders/:id/confirm-free` → biglietto emesso.
 *
 * Gli errori di dominio del §3.3 sono presentati **distinti**: `SOLD_OUT` è
 * definitivo, `ROLE_ON_HOLD` è temporaneo e sbloccabile,
 * `RESERVATION_ALREADY_ACTIVE` dice che un ordine è già in corso, e
 * `PARTIAL_AVAILABILITY` chiede una conferma, non è un rifiuto.
 */
@Component({
  selector: 'app-checkout',
  imports: [
    FormsModule,
    RouterLink,
    AccountStepComponent,
    ReservationCountdownComponent,
    I18nTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="www-narrow">
      @if (event(); as e) {
        <p class="crumb">
          <a [routerLink]="['/eventi', e.slug]">← Torna alla scheda dell’evento</a>
        </p>
        <h1 class="www-h1">Iscrizione</h1>
        <p class="www-lead"><app-i18n-text [value]="e.title" /></p>

        <app-reservation-countdown />

        @if (order.error(); as err) {
          <div
            class="www-notice"
            [class.www-notice-error]="err.tone === 'error'"
            [class.www-notice-warn]="err.tone === 'warning'"
            [class.www-notice-info]="err.tone === 'info'"
          >
            <strong>{{ err.title }}</strong>
            {{ err.detail }}
            @if (err.action === 'CHOOSE_ANOTHER') {
              <p class="notice-actions">
                <a class="www-btn www-btn-secondary" [routerLink]="['/eventi', e.slug]">
                  Vedi gli altri titoli d’ingresso
                </a>
              </p>
            }
          </div>
        }

        @switch (phase()) {
          @case ('CONFIRMED') {
            <div class="www-notice www-notice-ok">
              <strong>Iscrizione confermata</strong>
              L’iscrizione è registrata e il biglietto è stato emesso. Nessun addebito: questo
              titolo d’ingresso è a importo zero.
            </div>

            <div class="www-panel tickets">
              <h2 class="www-h2">Il tuo biglietto</h2>
              @for (t of order.tickets(); track t.id) {
                <div class="ticket">
                  <p class="holder">{{ t.holderName }} {{ t.holderSurname }}</p>
                  <p class="code">Codice: <code>{{ t.code }}</code></p>
                  <p class="www-hint">
                    È una conferma d’ordine con QR di accesso, non un titolo fiscale. Presentala
                    all’ingresso.
                  </p>
                </div>
              }
              <p class="actions">
                <a class="www-btn" [routerLink]="['/eventi', e.slug]">Torna all’evento</a>
              </p>
            </div>
          }

          @case ('EXPIRED') {
            <div class="www-notice www-notice-warn">
              <strong>Prenotazione scaduta</strong>
              I quindici minuti sono trascorsi: i posti sono tornati disponibili per tutti e
              <strong>non è stato addebitato nulla</strong>. Puoi rifare la richiesta — se i posti
              ci sono ancora, la prenotazione riparte da capo.
            </div>
            <p class="actions">
              <button type="button" class="www-btn" (click)="restart()">Riprova l’iscrizione</button>
            </p>
          }

          @case ('RESERVED') {
            <div class="www-panel">
              <h2 class="www-h2">Riepilogo</h2>
              <div class="row">
                <span><app-i18n-text [value]="chosen()?.name" /></span>
                <span>{{ money(order.order()?.subtotal ?? 0) }}</span>
              </div>
              @if ((order.order()?.presaleRights ?? 0) > 0) {
                <div class="row">
                  <span>Diritti di prevendita</span>
                  <span>{{ money(order.order()?.presaleRights ?? 0) }}</span>
                </div>
              }
              <div class="row total">
                <span>Totale</span>
                <span>{{ money(order.order()?.total ?? 0) }}</span>
              </div>

              @if ((order.order()?.total ?? 0) === 0) {
                <p class="www-hint">
                  L’ordine è a importo zero: si chiude senza prestatore di pagamento e il biglietto
                  viene emesso subito.
                </p>
                <p class="actions">
                  <button type="button" class="www-btn" [disabled]="order.busy()" (click)="confirm()">
                    {{ order.busy() ? 'Conferma in corso…' : 'Conferma l’iscrizione' }}
                  </button>
                  <button type="button" class="www-btn www-btn-secondary" (click)="cancel()">
                    Annulla e libera i posti
                  </button>
                </p>
              } @else {
                <div class="www-notice www-notice-info">
                  <strong>Questo titolo d’ingresso richiede un pagamento</strong>
                  Il pagamento online con carta non è attivo su questa installazione: questo
                  percorso copre le sole iscrizioni a importo zero. I posti restano impegnati fino
                  alla scadenza qui sopra; puoi liberarli subito con «Annulla».
                </div>
                <p class="actions">
                  <button type="button" class="www-btn www-btn-secondary" (click)="cancel()">
                    Annulla e libera i posti
                  </button>
                </p>
              }
            </div>
          }

          @default {
            @if (!auth.isAuthenticated()) {
              <app-account-step />
            } @else {
              <form class="www-panel" (ngSubmit)="reserve()">
                <h2 class="www-h2">Scegli il titolo d’ingresso</h2>

                <div class="www-field">
                  <label class="www-label" for="tt">Titolo d’ingresso</label>
                  <select id="tt" class="www-select" name="tt" [ngModel]="ticketTypeId()" (ngModelChange)="ticketTypeId.set(+$event)">
                    @for (tt of selectable(); track tt.id) {
                      <option [value]="tt.id">{{ label(tt) }}</option>
                    }
                  </select>
                </div>

                @if (chosen(); as tt) {
                  @if (tt.saleUnit === 'PER_COUPLE') {
                    <p class="www-hint">
                      È un titolo <strong>per coppia</strong>: l’iscrizione è una sola transazione a
                      due persone con ruoli complementari.
                    </p>
                  }
                  @if (tt.roleConstraint) {
                    <p class="www-hint">
                      Questo titolo è riservato al ruolo
                      {{ tt.roleConstraint === 'LEADER' ? 'leader' : 'follower' }}.
                    </p>
                  }
                }

                <h2 class="www-h2 spaced">Chi partecipa</h2>
                @for (a of attendees(); track $index) {
                  <fieldset class="person">
                    <legend>Partecipante {{ $index + 1 }}</legend>
                    <div class="grid">
                      <div class="www-field">
                        <label class="www-label" [attr.for]="'n' + $index">Nome</label>
                        <input
                          [id]="'n' + $index"
                          class="www-input"
                          [name]="'name' + $index"
                          [ngModel]="a.name"
                          (ngModelChange)="patch($index, { name: $event })"
                          required
                        />
                      </div>
                      <div class="www-field">
                        <label class="www-label" [attr.for]="'s' + $index">Cognome</label>
                        <input
                          [id]="'s' + $index"
                          class="www-input"
                          [name]="'surname' + $index"
                          [ngModel]="a.surname"
                          (ngModelChange)="patch($index, { surname: $event })"
                          required
                        />
                      </div>
                      <div class="www-field wide">
                        <label class="www-label" [attr.for]="'e' + $index">Email</label>
                        <input
                          [id]="'e' + $index"
                          class="www-input"
                          type="email"
                          [name]="'email' + $index"
                          [ngModel]="a.email"
                          (ngModelChange)="patch($index, { email: $event })"
                          required
                        />
                      </div>
                      <div class="www-field wide">
                        <label class="www-label" [attr.for]="'r' + $index">Ruolo di ballo</label>
                        <select
                          [id]="'r' + $index"
                          class="www-select"
                          [name]="'role' + $index"
                          [ngModel]="a.declaredRole"
                          (ngModelChange)="patch($index, { declaredRole: $event })"
                        >
                          <option value="LEADER">Leader</option>
                          <option value="FOLLOWER">Follower</option>
                          <option value="FLEXIBLE">Ruolo flessibile — decide l’organizzatore</option>
                        </select>
                        <span class="www-hint">
                          Il ruolo è indipendente dal genere: è la dimensione con cui l’organizzatore
                          tiene in equilibrio la sala. Con «flessibile» ti assegna il ruolo che serve.
                        </span>
                      </div>
                    </div>
                  </fieldset>
                }

                <p class="actions">
                  <button type="submit" class="www-btn" [disabled]="order.busy() || !ticketTypeId()">
                    {{ order.busy() ? 'Prenotazione…' : 'Prenota per 15 minuti' }}
                  </button>
                </p>
                <p class="www-hint">
                  La prenotazione impegna i posti per quindici minuti. Nessun addebito viene
                  effettuato in questo passaggio.
                </p>
              </form>
            }
          }
        }
      } @else {
        <h1 class="www-h1">Evento non trovato</h1>
        <p><a class="www-btn" routerLink="/eventi">Torna alla ricerca</a></p>
      }
    </div>
  `,
  styles: [
    `
      .crumb {
        margin: 0 0 0.5rem;
      }
      .crumb a {
        color: rgba(var(--text-rgb), 0.7);
        text-decoration: none;
        font-size: 0.9rem;
      }
      .www-h2.spaced {
        margin-top: 1.5rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .www-field.wide {
        grid-column: 1 / -1;
      }
      .person {
        border: 1px solid rgba(var(--text-rgb), 0.14);
        border-radius: var(--www-radius);
        padding: 0.9rem 1rem;
        margin-bottom: 0.75rem;
      }
      .person legend {
        padding: 0 0.4rem;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(var(--text-rgb), 0.7);
      }
      .row {
        display: flex;
        justify-content: space-between;
        padding: 0.4rem 0;
        border-bottom: 1px solid rgba(var(--text-rgb), 0.1);
      }
      .row.total {
        font-weight: 700;
        color: rgb(var(--accent-rgb));
        border-bottom: 0;
      }
      .actions {
        margin-top: 1rem;
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }
      .notice-actions {
        margin-top: 0.75rem;
      }
      .ticket {
        border-top: 1px solid rgba(var(--text-rgb), 0.12);
        padding-top: 0.75rem;
        margin-top: 0.75rem;
      }
      .holder {
        font-weight: 600;
        margin: 0;
      }
      .code {
        margin: 0.25rem 0;
      }
      code {
        letter-spacing: 0.08em;
        color: rgb(var(--accent-rgb));
      }
      @media (max-width: 560px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CheckoutPage {
  protected readonly events = inject(EventStore);
  protected readonly order = inject(OrderStore);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly money = money;
  protected readonly event = this.events.current;
  protected readonly phase = this.order.phase;

  protected readonly ticketTypeId = signal<number | null>(null);
  protected readonly attendees = signal<OrderAttendee[]>([]);

  /** I titoli pubblici su cui l'iscrizione è ancora possibile. */
  protected readonly selectable = computed(() => {
    const avail = this.events.availability();
    return (this.event()?.ticketTypes ?? [])
      .filter((tt) => tt.visibility === 'PUBLIC')
      .filter((tt) => {
        const a = avail?.ticketTypes.find((x) => x.id === tt.id);
        return !a || (!a.soldOut && !a.roleOnHold);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  protected readonly chosen = computed<PublicTicketType | null>(
    () => this.selectable().find((t) => t.id === this.ticketTypeId()) ?? null,
  );

  constructor() {
    const e = this.event();
    this.seo.apply({
      title: e ? `Iscrizione — ${text(e.title)} | Mirada Tango` : 'Iscrizione | Mirada Tango',
      description: 'Iscrizione online all’evento: prenotazione di quindici minuti, nessun addebito.',
      path: this.router.url.split('?')[0],
    });
    this.seo.setJsonLd(null);

    const requested = Number(this.route.snapshot.queryParamMap.get('titolo'));
    const preset = this.selectable().find((t) => t.id === requested) ?? this.selectable()[0] ?? null;
    this.ticketTypeId.set(preset?.id ?? null);
    this.syncAttendees();

    // Il primo partecipante è chi si sta iscrivendo: appena il profilo arriva —
    // subito, o dopo la registrazione — i suoi dati compaiono già scritti.
    // Un `effect` invece di una `then`: l'ordine fra il caricamento del profilo
    // e la creazione delle righe non è garantito, e alla prima stesura la
    // precompilazione non avveniva mai.
    effect(() => {
      if (this.auth.user()) this.prefillFromProfile();
    });

    void this.auth.loadProfile();
  }

  protected patch(index: number, changes: Partial<OrderAttendee>): void {
    this.attendees.update((list) =>
      list.map((a, i) => (i === index ? { ...a, ...changes } : a)),
    );
  }

  protected label(tt: PublicTicketType): string {
    const live = this.events.availability()?.ticketTypes.find((a) => a.id === tt.id);
    const cents = live?.activeTier?.price ?? tt.basePrice;
    const unit = tt.saleUnit === 'PER_COUPLE' ? ' (per coppia)' : '';
    return `${text(tt.name)}${unit} — ${cents === 0 ? 'gratuito' : money(cents)}`;
  }

  protected async reserve(): Promise<void> {
    const e = this.event();
    const tt = this.chosen();
    if (!e || !tt) return;
    this.syncAttendees();
    const ok = await this.order.reserve(
      e.id,
      [{ ticketTypeId: tt.id, quantity: 1 }],
      this.attendees(),
    );
    if (ok) void this.events.loadAvailability(e.id);
  }

  protected async confirm(): Promise<void> {
    const ok = await this.order.confirmFree();
    const e = this.event();
    if (ok && e) void this.events.loadAvailability(e.id);
  }

  protected async cancel(): Promise<void> {
    await this.order.abandon();
    const e = this.event();
    if (e) void this.events.loadAvailability(e.id);
  }

  protected restart(): void {
    this.order.reset();
  }

  /** Un partecipante per persona; due se il titolo si vende **per coppia**. */
  private syncAttendees(): void {
    const wanted = this.chosen()?.saleUnit === 'PER_COUPLE' ? 2 : 1;
    const constraint = this.chosen()?.roleConstraint;
    this.attendees.update((list) => {
      const next = [...list];
      while (next.length < wanted) {
        next.push({
          name: '',
          surname: '',
          email: '',
          declaredRole: (constraint ?? 'FLEXIBLE') as DeclaredDanceRole,
        });
      }
      next.length = wanted;
      // Su un titolo per coppia i ruoli sono complementari per definizione.
      if (wanted === 2 && next[0].declaredRole !== 'FLEXIBLE') {
        next[1] = {
          ...next[1],
          declaredRole: next[0].declaredRole === 'LEADER' ? 'FOLLOWER' : 'LEADER',
        };
      }
      return next;
    });
  }

  private prefillFromProfile(): void {
    const u = this.auth.user();
    if (!u?.person) return;
    this.attendees.update((list) =>
      list.map((a, i) =>
        i === 0
          ? {
              ...a,
              name: a.name || u.person!.name,
              surname: a.surname || u.person!.surname,
              email: a.email || (u.person!.contact?.email ?? ''),
            }
          : a,
      ),
    );
  }
}
