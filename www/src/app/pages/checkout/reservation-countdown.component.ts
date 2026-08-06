import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { OrderStore } from '../../stores/order.store';
import { countdown } from '../../core/format/format';

/**
 * Il conto alla rovescia della prenotazione — **sempre visibile** (`RF-PAY-20`).
 *
 * La prenotazione impegna la capienza per quindici minuti: finché scorre, quei
 * posti non sono di nessun altro. Quando restano pochi minuti la barra cambia
 * tono e lo dice a parole, perché un numero che scende non è un avviso.
 *
 * Alla scadenza **nessun addebito** e ritorno al carrello (`RF-PAY-21`): il
 * messaggio lo dichiara, invece di lasciare il dubbio.
 */
@Component({
  selector: 'app-reservation-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="bar" [class.warn]="store.nearlyExpired()" role="status" aria-live="polite">
        <span class="clock">{{ label() }}</span>
        <span class="msg">
          @if (store.nearlyExpired()) {
            Restano pochi minuti: completa l’iscrizione o i posti torneranno disponibili per gli
            altri. Nessun addebito in caso di scadenza.
          } @else {
            Posti impegnati per te. Alla scadenza tornano disponibili e non viene addebitato nulla.
          }
        </span>
      </div>
    }
  `,
  styles: [
    `
      .bar {
        position: sticky;
        top: 3.6rem;
        z-index: 15;
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.65rem 1rem;
        border-radius: var(--www-radius);
        border: 1px solid rgba(var(--accent-rgb), 0.5);
        background: rgba(var(--accent-rgb), 0.12);
        margin-bottom: 1.25rem;
      }
      .bar.warn {
        border-color: rgba(var(--keijo-warning), 0.75);
        background: rgba(var(--keijo-warning), 0.16);
      }
      .clock {
        font-size: 1.4rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: rgb(var(--text-rgb));
      }
      .msg {
        font-size: 0.88rem;
        line-height: 1.45;
        color: rgba(var(--text-rgb), 0.85);
      }
    `,
  ],
})
export class ReservationCountdownComponent {
  protected readonly store = inject(OrderStore);

  protected readonly visible = computed(() => this.store.phase() === 'RESERVED');
  protected readonly label = computed(() => countdown(this.store.remainingMs()));
}
