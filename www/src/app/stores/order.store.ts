import { Injectable, NgZone, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiClient } from '../core/api/api.client';
import { ApiError } from '../core/api/api-error';
import { PublicDomainError, describeError } from '../core/api/domain-error';
import {
  FulfilmentOutcome,
  Order,
  OrderAttendee,
  OrderReserveLine,
  ReserveOutcome,
  Ticket,
} from '../core/domain/models';

/**
 * Store dell'entità `Order` (§5: uno store per entità).
 *
 * Percorso del §3.7, nella versione **senza pagamento**:
 *
 *  1. `POST /api/orders/reserve`       → prenotazione di **15 minuti**, capienza impegnata
 *  2. `POST /api/orders/:id/confirm-free` → biglietto emesso
 *  3. `POST /api/orders/:id/abandon`   → rilascio immediato dell'impegno
 *
 * Il conto alla rovescia è **sempre visibile** (`RF-PAY-20`) e alla scadenza si
 * torna al carrello con un messaggio esplicito e **nessun addebito**
 * (`RF-PAY-21`).
 */

/** Sotto questa soglia il conto alla rovescia diventa un avviso (`RF-PAY-20`). */
export const WARN_AT_MS = 3 * 60_000;

export type OrderPhase = 'IDLE' | 'RESERVED' | 'EXPIRED' | 'CONFIRMED';

@Injectable({ providedIn: 'root' })
export class OrderStore {
  private readonly api = inject(ApiClient);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _order = signal<Order | null>(null);
  private readonly _expiresAt = signal<string | null>(null);
  private readonly _now = signal<number>(Date.now());
  private readonly _phase = signal<OrderPhase>('IDLE');
  private readonly _busy = signal(false);
  private readonly _error = signal<PublicDomainError | null>(null);
  private readonly _tickets = signal<Ticket[]>([]);

  readonly order = this._order.asReadonly();
  readonly phase = this._phase.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly error = this._error.asReadonly();
  readonly tickets = this._tickets.asReadonly();

  /** Millisecondi residui della prenotazione, mai negativi. */
  readonly remainingMs = computed(() => {
    const iso = this._expiresAt();
    if (!iso) return 0;
    return Math.max(0, new Date(iso).getTime() - this._now());
  });

  /** `true` quando restano pochi minuti: l'avviso è parte del requisito. */
  readonly nearlyExpired = computed(
    () => this._phase() === 'RESERVED' && this.remainingMs() > 0 && this.remainingMs() <= WARN_AT_MS,
  );

  readonly expired = computed(() => this._phase() === 'EXPIRED');

  private ticker: ReturnType<typeof setInterval> | null = null;

  /**
   * `POST /api/orders/reserve` — crea l'ordine, blocca il prezzo e impegna
   * atomicamente la capienza. Fallisce con i codici del §3.3, che qui vengono
   * **distinti**, non fusi in un «errore».
   */
  async reserve(eventId: number, lines: OrderReserveLine[], attendees: OrderAttendee[]): Promise<boolean> {
    this._busy.set(true);
    this._error.set(null);
    try {
      const res = await this.api.post<ReserveOutcome>('/orders/reserve', {
        eventId,
        lines,
        attendees,
      });
      const order = res.orders[0] ?? null;
      this._order.set(order);
      this._expiresAt.set(res.expiresAt ?? order?.expiresAt ?? null);
      this._phase.set('RESERVED');
      this._tickets.set([]);
      this.startTicker();
      return true;
    } catch (err) {
      this._error.set(describeError(err));
      if (err instanceof ApiError && err.code === 'RESERVATION_EXPIRED') this._phase.set('EXPIRED');
      return false;
    } finally {
      this._busy.set(false);
    }
  }

  /**
   * `POST /api/orders/:id/confirm-free` — chiude un ordine **senza prestatore di
   * pagamento**: risolve i ruoli flessibili, conferma le iscrizioni, emette i
   * biglietti e rilascia la prenotazione. Ammesso solo a totale zero (§3.7).
   */
  async confirmFree(): Promise<boolean> {
    const order = this._order();
    if (!order) return false;
    this._busy.set(true);
    this._error.set(null);
    try {
      const res = await this.api.post<FulfilmentOutcome>(`/orders/${order.id}/confirm-free`, {});
      this._order.set(res.order);
      this._tickets.set(res.tickets ?? []);
      this._phase.set('CONFIRMED');
      this.stopTicker();
      return true;
    } catch (err) {
      this._error.set(describeError(err));
      if (err instanceof ApiError && err.code === 'RESERVATION_EXPIRED') this.markExpired();
      return false;
    } finally {
      this._busy.set(false);
    }
  }

  /** `POST /api/orders/:id/abandon` — rilascio immediato dell'impegno. */
  async abandon(): Promise<void> {
    const order = this._order();
    this.stopTicker();
    if (order && this._phase() === 'RESERVED') {
      try {
        await this.api.post(`/orders/${order.id}/abandon`, {});
      } catch {
        // Il rilascio è comunque garantito dalla scadenza: se la chiamata non
        // riesce, i posti tornano liberi allo scadere dei quindici minuti.
      }
    }
    this.reset();
  }

  reset(): void {
    this.stopTicker();
    this._order.set(null);
    this._expiresAt.set(null);
    this._phase.set('IDLE');
    this._error.set(null);
    this._tickets.set([]);
  }

  clearError(): void {
    this._error.set(null);
  }

  private markExpired(): void {
    this._phase.set('EXPIRED');
    this.stopTicker();
  }

  /**
   * Il tic del conto alla rovescia vive **solo nel browser** e **fuori dalla
   * zona Angular**: un intervallo ricorrente dentro la zona terrebbe
   * l'applicazione perennemente instabile e l'idratazione non si completerebbe
   * mai (`NG0506`). Il secondo che passa rientra nella zona per aggiornare i
   * signal, così la barra si ridisegna.
   */
  private startTicker(): void {
    if (!this.isBrowser) return;
    this.stopTicker();
    this._now.set(Date.now());
    this.zone.runOutsideAngular(() => {
      this.ticker = setInterval(() => {
        this.zone.run(() => {
          this._now.set(Date.now());
          if (this.remainingMs() <= 0 && this._phase() === 'RESERVED') this.markExpired();
        });
      }, 1000);
    });
  }

  private stopTicker(): void {
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}
