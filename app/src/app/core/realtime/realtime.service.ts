import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/**
 * Canale WebSocket keijo (§3.9).
 *
 * **Semantica: notifica e trigger di refetch, non canale di dati di dominio.**
 * Alla ricezione di un `EventEnvelope` il frontend **rifà la chiamata REST** e
 * aggiorna lo store: il payload non entra mai direttamente nello store (§5).
 * Qui il payload serve soltanto a decidere *se* ricaricare e *cosa*.
 *
 * Connessione a `WS_URL/<wsCode>`, dove `wsCode` arriva da `GET /auth/profile`.
 * In sviluppo il dev-server inoltra `/ws` al backend (`proxy.conf.json`,
 * `ws: true`), così l'URL resta relativo all'origine anche dietro un reverse
 * proxy in produzione.
 */

/** Busta di trasporto del §3.9. */
export interface EventEnvelope<T = unknown> {
  messageId: string;
  timestamp: string;
  source?: string;
  event: string;
  payload: T;
}

/** Nomi degli eventi che questa applicazione ascolta (§3.9). */
export const REALTIME_EVENTS = {
  availabilityChanged: 'event/availability-changed',
  registrationCreated: 'registration/created',
  checkinRegistered: 'checkin/registered',
} as const;

export interface OrganizationScopedPayload {
  eventId?: number;
  organizationId?: number;
  registrationId?: number;
  sessionId?: number;
}

type Listener = (envelope: EventEnvelope<OrganizationScopedPayload>) => void;

const RECONNECT_DELAY_MS = 5_000;

@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly auth = inject(AuthService);

  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUs = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  private readonly _connected = signal(false);
  /** Stato del canale: la pagina lo dichiara, non lo dà per scontato. */
  readonly connected = this._connected.asReadonly();

  /**
   * Registra un ascoltatore su un nome di evento e restituisce la funzione di
   * disiscrizione. La connessione viene aperta al primo ascoltatore.
   */
  on(event: string, listener: Listener): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    this.connect();
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(event);
      if (this.listeners.size === 0) this.disconnect();
    };
  }

  private connect(): void {
    if (this.socket || this.reconnectTimer) return;
    const wsCode = this.auth.wsCode();
    // Il visitatore senza `wsCode` non ha canale: il polling pubblico è di `www`.
    if (!wsCode) return;

    this.closedByUs = false;
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${window.location.host}/ws/${wsCode}`;

    try {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => this._connected.set(true);
      socket.onmessage = (msg) => this.dispatch(msg.data);
      socket.onerror = () => this._connected.set(false);
      socket.onclose = () => {
        this._connected.set(false);
        this.socket = null;
        if (!this.closedByUs && this.listeners.size > 0) this.scheduleReconnect();
      };
    } catch {
      this.socket = null;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private dispatch(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let envelope: EventEnvelope<OrganizationScopedPayload>;
    try {
      envelope = JSON.parse(raw) as EventEnvelope<OrganizationScopedPayload>;
    } catch {
      return;
    }
    const set = this.listeners.get(envelope.event);
    if (!set) return;
    for (const listener of set) listener(envelope);
  }

  private disconnect(): void {
    this.closedByUs = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this._connected.set(false);
  }

  ngOnDestroy(): void {
    this.listeners.clear();
    this.disconnect();
  }
}
