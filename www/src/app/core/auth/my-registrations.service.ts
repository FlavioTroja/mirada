import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api.client';
import { AuthService } from './auth.service';
import { MyRegistration, MyRegistrations } from '../domain/models';

/**
 * **Le proprie iscrizioni** — `GET /api/registrations/mine`.
 *
 * ── Perché non è l'elenco paginato ───────────────────────────────────────────
 * `POST /registrations/` è la schermata di lavoro dell'organizzatore, filtrata
 * per organizzazione: chi balla non appartiene ad alcuna organizzazione e da lì
 * otterrebbe zero righe — cioè le proprie iscrizioni nascoste da un filtro
 * pensato per tutt'altro. La rotta `mine` filtra sulla persona.
 *
 * La divisione fra prossimi e passati la fa il server, sulla **fine**
 * dell'evento: qui non si ricalcola, altrimenti la stessa regola vivrebbe in due
 * posti e un fuso orario diverso basterebbe a farli discordare proprio il giorno
 * dell'evento.
 */
@Injectable({ providedIn: 'root' })
export class MyRegistrationsService {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);

  private readonly _upcoming = signal<MyRegistration[]>([]);
  private readonly _past = signal<MyRegistration[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _failed = signal(false);

  readonly upcoming = this._upcoming.asReadonly();
  readonly past = this._past.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly failed = this._failed.asReadonly();

  /** Vero solo a lettura conclusa: distingue «non ne hai» da «non ancora letto». */
  readonly isEmpty = computed(
    () => this._loaded() && !this._upcoming().length && !this._past().length,
  );

  constructor() {
    effect(() => {
      if (!this.auth.isAuthenticated()) this.clear();
    });
  }

  async load(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    this._loading.set(true);
    this._failed.set(false);
    try {
      const res = await this.api.fetch<MyRegistrations>('/registrations/mine');
      this._upcoming.set(res.upcoming ?? []);
      this._past.set(res.past ?? []);
      this._loaded.set(true);
    } catch {
      // Le proprie iscrizioni sono una parte della pagina, non la pagina: se
      // non arrivano si dice, e il resto del profilo resta utilizzabile.
      this._failed.set(true);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Il QR di un biglietto, come URL di oggetto pronto per un `<img>`.
   *
   * Arriva come immagine e non come testo: il contenuto del QR è un JWS
   * firmato, cioè la chiave d'ingresso, e non ha ragione di transitare per la
   * memoria della pagina quando ciò che serve è disegnarlo.
   */
  async qrUrl(ticketId: number): Promise<string> {
    const blob = await this.api.fetchBlob(`/tickets/${ticketId}/qr`);
    return URL.createObjectURL(blob);
  }

  clear(): void {
    this._upcoming.set([]);
    this._past.set([]);
    this._loaded.set(false);
    this._failed.set(false);
  }
}
