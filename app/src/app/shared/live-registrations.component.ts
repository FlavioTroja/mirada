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
import { REALTIME_EVENTS, RealtimeService } from '../core/realtime/realtime.service';
import { Registration } from '../core/domain/models';
import {
  DANCE_ROLE_UI,
  DECLARED_DANCE_ROLE_UI,
  REGISTRATION_CHANNEL_UI,
  StatusUi,
} from '../core/domain/enums';
import { StatusPillComponent } from './status-pill.component';

/** Una riga del flusso: l'iscrizione più il momento in cui è **arrivata**. */
interface ArrivedRegistration {
  registration: Registration;
  arrivedAt: Date;
}

/**
 * **Il flusso delle iscrizioni in arrivo**, in tempo reale.
 *
 * Il cruscotto già si aggiornava da solo alla ricezione di `registration/created`
 * (§3.9), ma un contatore che passa da 11 a 12 non racconta niente: non dice
 * *chi* è arrivato, con quale ruolo, da quale canale. Questa sezione mostra
 * l'evento invece del suo effetto — che è ciò che un organizzatore guarda la sera
 * dell'apertura vendite.
 *
 * **Semantica keijo (§3.9): il WebSocket è un trigger di refetch, non un canale
 * di dati.** Il frame porta i soli identificativi e l'iscrizione si rilegge via
 * REST; il payload non entra mai nello stato.
 *
 * La lettura passa da `ApiClient` e **non** da `RegistrationStore.loadOne`, che
 * scriverebbe `current()` dello store condiviso: un flusso in arrivo non deve
 * cambiare l'entità selezionata sotto le altre pagine.
 *
 * L'elenco è **limitato** e vive solo in pagina: è una finestra sul presente, non
 * un registro — quello è `/registrations`, paginato e filtrabile.
 */
@Component({
  selector: 'app-live-registrations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageSectionWrapperComponent, StatusPillComponent],
  template: `
    <keijo-page-section-wrapper title="Iscrizioni in arrivo">
      <p class="mirada-hint">
        @if (realtime.connected()) {
          Il flusso è aperto: ogni nuova iscrizione a questo evento compare qui appena il
          server la registra, senza ricaricare la pagina.
        } @else {
          Flusso non collegato: la pagina resta ferma al momento del caricamento.
        }
      </p>

      @if (arrived().length) {
        <ul class="feed">
          @for (row of arrived(); track row.registration.id) {
            <li class="row">
              <span class="when">{{ time(row.arrivedAt) }}</span>
              <span class="who">{{ name(row.registration) }}</span>
              <app-status-pill [status]="roleUi(row.registration)" />
              <app-status-pill [status]="channelUi(row.registration)" />
            </li>
          }
        </ul>
        <p class="mirada-hint">
          Ultime {{ arrived().length }} arrivate da quando hai aperto la pagina. Lo storico
          completo è in <strong>Iscritti</strong>.
        </p>
      } @else {
        <p class="mirada-muted">Nessuna iscrizione da quando hai aperto la pagina.</p>
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
           tutto il prodotto, non solo sulla wall (§5, accessibilità). */
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
      .when {
        font-variant-numeric: tabular-nums;
        font-size: 0.75rem;
        color: rgba(var(--text-rgb), 0.6);
      }
      .who {
        font-weight: 600;
        margin-right: auto;
      }
    `,
  ],
})
export class LiveRegistrationsComponent implements OnInit {
  /** L'evento osservato. I frame di altri eventi vengono ignorati. */
  readonly eventId = input.required<number | null>();

  readonly realtime = inject(RealtimeService);
  private readonly api = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly rows = signal<ArrivedRegistration[]>([]);
  readonly arrived = computed(() => this.rows());

  /** Oltre questa soglia la finestra scorre: è un flusso, non un archivio. */
  private static readonly MAX_ROWS = 12;

  ngOnInit(): void {
    const off = this.realtime.on(REALTIME_EVENTS.registrationCreated, (frame) => {
      const eventId = this.eventId();
      if (eventId === null || frame.payload?.['eventId'] !== eventId) return;

      const registrationId = frame.payload?.['registrationId'] as number | undefined;
      if (!registrationId) return;

      void this.pull(registrationId);
    });
    this.destroyRef.onDestroy(off);
  }

  private async pull(registrationId: number): Promise<void> {
    try {
      const registration = await this.api.get<Registration>('registrations', registrationId);
      this.rows.update((current) =>
        [{ registration, arrivedAt: new Date() }, ...current].slice(
          0,
          LiveRegistrationsComponent.MAX_ROWS,
        ),
      );
    } catch {
      // Un'iscrizione non leggibile — cancellata nel frattempo, o fuori dal
      // proprio scope di organizzazione — non deve far cadere il flusso.
    }
  }

  name(r: Registration): string {
    return `${r.holderName} ${r.holderSurname}`.trim();
  }

  /**
   * Ruolo **assegnato** quando c'è, altrimenti quello dichiarato: sono due cose
   * diverse e l'interfaccia non deve fonderle — il flessibile si risolve alla
   * conferma, e fino a quel momento «da assegnare» è l'informazione vera.
   */
  roleUi(r: Registration): StatusUi {
    return r.assignedRole
      ? DANCE_ROLE_UI[r.assignedRole]
      : DECLARED_DANCE_ROLE_UI[r.declaredRole];
  }

  channelUi(r: Registration): StatusUi {
    return REGISTRATION_CHANNEL_UI[r.channel];
  }

  time(d: Date): string {
    return d.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
