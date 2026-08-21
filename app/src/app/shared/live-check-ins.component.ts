import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { PageSectionWrapperComponent } from '@keijo/ui';
import { ApiClient } from '../core/api/api.client';
import { PaginateDatasource } from '../core/api/paginate';
import { REALTIME_EVENTS, RealtimeService } from '../core/realtime/realtime.service';
import { liveOn } from '../core/realtime/live';
import { CheckIn } from '../core/domain/models';
import { i18nPlain } from '../core/i18n/i18n-text';

/** Una riga del flusso: l'ingresso, piu come e arrivato fin qui. */
interface EnteredRow {
  checkIn: CheckIn;
  /** `true` quando la riga viene da una coda offline riversata adesso. */
  late: boolean;
}

/**
 * **Il flusso degli ingressi**, in tempo reale.
 *
 * Il cruscotto gia si aggiornava alla ricezione di `checkin/registered`, ma un
 * contatore che passa da 87 a 88 non racconta niente: non dice *chi* e entrato,
 * su quale sessione, a che ora. Questa sezione mostra l'evento invece del suo
 * effetto — che e cio che l'organizzatore guarda mentre la sala si riempie.
 * Gemello di `LiveRegistrationsComponent`, dall'altro capo della serata.
 *
 * ── Il pavimento del tempo reale, e perche va mostrato ──────────────────────
 * Il check-in funziona **senza rete**: si scansiona, si accoda, si sincronizza
 * quando la rete torna. Quindi un ingresso puo arrivare qui mezz'ora dopo essere
 * avvenuto, e insieme ad altri trenta.
 *
 * Il flusso lo dice in due modi, e nessuno dei due e cosmetico:
 *  - l'ora mostrata e sempre **`scannedAt`**, il momento della scansione sul
 *    dispositivo, mai il momento in cui il frame e arrivato;
 *  - le righe sincronizzate portano un contrassegno esplicito.
 *
 * Senza, trenta ingressi vecchi comparirebbero come appena accaduti e il numero
 * di persone in sala — che e un dato di sicurezza — direbbe una cosa falsa
 * proprio nel momento in cui serve vera.
 *
 * ── Semantica §3.9 ──────────────────────────────────────────────────────────
 * Il WebSocket e un trigger di refetch: il frame porta identificativi e un
 * discriminante, gli ingressi si rileggono via REST.
 */
@Component({
  selector: 'app-live-check-ins',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageSectionWrapperComponent],
  template: `
    <keijo-page-section-wrapper title="Ingressi in tempo reale">
      <p class="mirada-hint">
        @if (realtime.connected()) {
          Il flusso e aperto: ogni scansione alla porta compare qui appena il server la
          registra.
        } @else {
          Flusso non collegato: la pagina resta ferma al momento del caricamento.
        }
      </p>

      @if (rows().length) {
        <ul class="feed">
          @for (row of rows(); track row.checkIn.id) {
            <li class="row" [class.late]="row.late" [class.revoked]="!!row.checkIn.revokedAt">
              <span class="when">{{ time(row.checkIn.scannedAt) }}</span>
              <span class="who">{{ name(row.checkIn) }}</span>
              <span class="where">{{ where(row.checkIn) }}</span>

              @if (row.checkIn.revokedAt) {
                <span class="tag tag-revoked">annullato</span>
              } @else if (row.late) {
                <!-- Non e un dettaglio grafico: dice che quell'ingresso e
                     avvenuto prima, e che il contatore lo ha appena appreso. -->
                <span class="tag tag-late">da coda offline</span>
              }
            </li>
          }
        </ul>

        @if (syncedBatch(); as batch) {
          <p class="mirada-hint">
            Un dispositivo ha appena riversato la propria coda: {{ batch }}
            {{ batch === 1 ? 'ingresso gia avvenuto' : 'ingressi gia avvenuti' }} sono entrati
            adesso nel conteggio.
          </p>
        }

        <p class="mirada-hint">
          Ultimi {{ rows().length }} ingressi. L'ora e quella della scansione, non quella in cui
          il dato e arrivato.
        </p>
      } @else {
        <p class="mirada-muted">Nessun ingresso registrato per questo evento.</p>
      }
    </keijo-page-section-wrapper>
  `,
  styles: [
    `
      .feed {
        list-style: none;
        margin: 0.5rem 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.4rem 0.625rem;
        border-radius: 4px;
        background: rgba(var(--text-rgb), 0.05);
        /* Dissolvenza morbida, mai uno stacco: la regola sui lampeggi vale in
           tutto il prodotto (accessibilita), e qui c'e anche una ragione
           pratica — chi sta alla porta guarda lo schermo di sfuggita. */
        animation: appear 600ms ease-out;
      }
      @keyframes appear {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      .row.late {
        background: rgba(var(--text-rgb), 0.03);
      }
      .row.revoked .who,
      .row.revoked .when {
        text-decoration: line-through;
        opacity: 0.65;
      }
      .when {
        font-variant-numeric: tabular-nums;
        font-size: 0.75rem;
        color: rgba(var(--text-rgb), 0.6);
      }
      .who {
        font-weight: 600;
      }
      .where {
        margin-right: auto;
        font-size: 0.8rem;
        color: rgba(var(--text-rgb), 0.6);
      }
      .tag {
        font-size: 0.7rem;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        white-space: nowrap;
      }
      .tag-late {
        color: rgb(var(--color-warning-rgb, 240 184 96));
        background: rgba(var(--text-rgb), 0.07);
      }
      .tag-revoked {
        background: rgba(var(--text-rgb), 0.07);
        opacity: 0.8;
      }
    `,
  ],
})
export class LiveCheckInsComponent implements OnInit {
  /** L'evento osservato. I frame di altri eventi vengono scartati. */
  readonly eventId = input.required<number | null>();

  readonly realtime = inject(RealtimeService);
  private readonly api = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly feed = signal<EnteredRow[]>([]);
  readonly rows = computed(() => this.feed());

  /** Quanti ingressi ha portato l'ultimo riversamento, finche resta in vista. */
  private readonly lastBatch = signal<number | null>(null);
  readonly syncedBatch = computed(() => this.lastBatch());

  /** Oltre questa soglia la finestra scorre: e un flusso, non un archivio. */
  private static readonly MAX_ROWS = 15;

  constructor() {
    // L'aggancio sta nel costruttore e non in `ngOnInit` perche `liveOn`
    // raccoglie `DestroyRef` dal contesto d'iniezione.
    liveOn(
      [REALTIME_EVENTS.checkinRegistered],
      (frame) => {
        const reason = frame.payload?.reason;
        const checkInId = frame.payload?.checkInId;

        if (reason === 'SCANNED' && checkInId) {
          this.lastBatch.set(null);
          void this.pullOne(checkInId, false);
          return;
        }

        if (reason === 'SYNCED') {
          // Un lotto: non c'e un ingresso da nominare, e si rilegge la coda.
          this.lastBatch.set(frame.payload?.count ?? null);
          void this.reload(true);
          return;
        }

        // `REVOKED` — e ogni frame di una versione del server che non dichiara
        // ancora il motivo: si rilegge, che e sempre corretto.
        void this.reload(false);
      },
      { eventId: () => this.eventId() },
    );
  }

  ngOnInit(): void {
    // La prima resa non aspetta un ingresso: chi apre la pagina a serata
    // iniziata deve vedere chi e gia entrato.
    void this.reload(false);
  }

  /**
   * Rilegge la coda degli ultimi ingressi.
   *
   * `markLate` contrassegna l'intera finestra come arrivata da una
   * sincronizzazione: e vero per il lotto appena riversato, e le righe piu
   * vecchie lo perdono al prossimo giro. La verita puntuale sta comunque nella
   * riga stessa — `syncedAt` valorizzato — e infatti e quella a decidere.
   */
  private async reload(markLate: boolean): Promise<void> {
    const eventId = this.eventId();
    if (eventId === null) return;

    try {
      const page = await this.api.post<PaginateDatasource<CheckIn>>('/check-ins/', {
        query: { eventId },
        options: {
          page: 1,
          limit: LiveCheckInsComponent.MAX_ROWS,
          sort: { scannedAt: 'desc' },
          populate: 'registration session',
        },
      });

      this.feed.set(
        page.docs.map((checkIn) => ({
          checkIn,
          // La riga sa da sé di essere passata da una coda: `syncedAt` e
          // valorizzato solo li. Il contrassegno del lotto e un di piu.
          late: !!checkIn.syncedAt || (markLate && checkIn.offline),
        })),
      );
    } catch {
      // Una lettura fallita non deve svuotare il flusso: meglio la finestra di
      // un minuto fa che una sezione vuota mentre la sala si riempie.
    }
  }

  private async pullOne(checkInId: number, late: boolean): Promise<void> {
    try {
      const checkIn = await this.api.get<CheckIn>('check-ins', checkInId, 'registration session');
      this.feed.update((current) =>
        [{ checkIn, late: late || !!checkIn.syncedAt }, ...current.filter((r) => r.checkIn.id !== checkIn.id)].slice(
          0,
          LiveCheckInsComponent.MAX_ROWS,
        ),
      );
    } catch {
      // Un ingresso non leggibile — annullato nel frattempo, o fuori dal proprio
      // scope — non deve far cadere il flusso.
    }
  }

  name(c: CheckIn): string {
    const r = c.registration;
    return r ? `${r.holderName} ${r.holderSurname}`.trim() : `Ingresso #${c.id}`;
  }

  where(c: CheckIn): string {
    return c.session ? i18nPlain(c.session.name, 'it', '') : '';
  }

  time(iso: string): string {
    return new Date(iso).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
