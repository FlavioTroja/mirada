import { Service } from "fastify-decorators";
import { Log } from "@utils/adapters/log";
import { Events } from "@websocket/events/Events";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { EventAvailabilityChangedPayloadDTO } from "@websocket/dtos/EventAvailabilityChangedPayloadDTO";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";

/** Finestra di aggregazione dichiarata dal §3.9: «aggregato con finestra di ~1,5 s». */
export const AVAILABILITY_AGGREGATION_WINDOW_MS = 1_500;

type PendingWindow = { organizationId: number; timer: NodeJS.Timeout; hits: number };

/**
 * Un timer per evento, **per processo**: la finestra di aggregazione è una
 * proprietà del processo, non dell'istanza del servizio. Tenerla a livello di
 * modulo la rende anche chiudibile in modo ordinato (`cancelAllAvailabilityWindows`),
 * che è ciò che impedisce a un timer sopravvissuto di fare I/O su una connessione
 * già chiusa — in produzione allo spegnimento, nella suite fra un file e l'altro.
 */
const pending = new Map<number, PendingWindow>();

/**
 * Quanti eventi hanno una finestra aperta, **a livello di processo**.
 *
 * Gemello di modulo di `pendingCount()`, e non un doppione: il metodo
 * d'istanza serve a chi ha gia il servizio iniettato, questa funzione a chi
 * osserva il processo senza averlo — la suite del motore di capienza, che
 * verifica che il segnale parta anche quando la transazione e del chiamante e
 * non ha alcun motivo di costruirsi un `AvailabilityBroadcastService`.
 */
export function pendingAvailabilityWindows(): number {
    return pending.size;
}

/**
 * Annulla ogni finestra aperta **senza inviare nulla**. Spegnimento ordinato e
 * isolamento fra file di test: un timer che scade dopo la chiusura del client
 * Prisma non deve nemmeno provare a leggere i destinatari.
 */
export function cancelAllAvailabilityWindows(): number {
    const cancelled = pending.size;
    for (const window of pending.values()) {
        clearTimeout(window.timer);
    }
    pending.clear();
    return cancelled;
}

/**
 * `event/availability-changed` — backend-brief §3.9 e §4.8.
 *
 * ── Due vincoli, entrambi non negoziabili ────────────────────────────────────
 *
 * 1. **Il publish avviene DOPO il commit, mai dentro la transazione di impegno.**
 *    `notify()` non tocca la rete: registra soltanto un timer. Il lavoro di
 *    risoluzione dei destinatari e di invio avviene ~1,5 s più tardi, fuori da
 *    qualunque transazione. Un Redis o un socket lento **non può** quindi
 *    rallentare una vendita, che è precisamente la ragione della regola.
 *
 * 2. **Solo `sendToUser`, mai `broadcastToRoles`.** I destinatari sono i membri
 *    dell'organizzazione proprietaria dell'evento, risolti uno per uno.
 *
 * L'aggregazione serve al caso reale che il §3.9 ha in mente: in apertura vendite
 * i contatori si muovono decine di volte al secondo, e un frame per movimento
 * trasformerebbe un segnale di refetch in una tempesta di refetch. Le notifiche
 * dello stesso evento nella finestra collassano in **un solo frame**.
 */
@Service()
export class AvailabilityBroadcastService {
    /** Alias sulla mappa di modulo: la finestra è per processo, non per istanza. */
    private readonly pending = pending;

    constructor(
        private readonly wsPublisher: WsPublisherService,
        private readonly organizationAudienceService: OrganizationAudienceService,
    ) {}

    /**
     * Segnala che i contatori dell'evento si sono mossi. **Non fa I/O**: è
     * chiamabile in coda a un `commit` o a un `release` senza costo misurabile.
     */
    public notify(eventId: number, organizationId: number): void {
        const existing = this.pending.get(eventId);
        if (existing) {
            existing.hits += 1;
            Log.debug(
                `[AvailabilityBroadcast Service]: availability change on event (id ${eventId}) `
                + `coalesced into the open ${AVAILABILITY_AGGREGATION_WINDOW_MS}ms window (${existing.hits} hits)`,
            );
            return;
        }

        const timer = setTimeout(() => {
            void this.flush(eventId);
        }, AVAILABILITY_AGGREGATION_WINDOW_MS);

        // `unref` così un timer aperto non tiene in vita il processo (né la suite di test).
        timer.unref?.();

        this.pending.set(eventId, { organizationId, timer, hits: 1 });
        Log.debug(`[AvailabilityBroadcast Service]: availability change on event (id ${eventId}) opened a ${AVAILABILITY_AGGREGATION_WINDOW_MS}ms window`);
    }

    /**
     * Invia subito il frame aggregato dell'evento, se ne è pendente uno. Serve ai
     * test e allo spegnimento ordinato: nessuna notifica resta appesa.
     */
    public async flush(eventId: number): Promise<boolean> {
        const entry = this.pending.get(eventId);
        if (!entry) {
            return false;
        }

        clearTimeout(entry.timer);
        this.pending.delete(eventId);

        const payload: EventAvailabilityChangedPayloadDTO = { eventId, organizationId: entry.organizationId };

        try {
            const wsCodes = await this.organizationAudienceService.resolveMemberWsCodes(entry.organizationId);
            if (!wsCodes.length) {
                Log.debug(`[AvailabilityBroadcast Service]: no reachable member for event (id ${eventId}) — nothing sent`);
                return true;
            }

            await this.wsPublisher.sendToUsers(wsCodes, Events.EVENT_AVAILABILITY_CHANGED, payload);
            Log.info(
                `[AvailabilityBroadcast Service]: published 'event/availability-changed' for event (id ${eventId}) `
                + `to ${wsCodes.length} member(s) of organization (id ${entry.organizationId}) — ${entry.hits} change(s) aggregated`,
            );
        } catch (err) {
            // Un errore di trasporto non deve mai risalire a una vendita già andata a
            // buon fine: la disponibilità si riallinea comunque al polling successivo.
            Log.error(`[AvailabilityBroadcast Service]: publish failed for event (id ${eventId}): ${(err as Error).message}`);
        }

        return true;
    }

    /** Svuota ogni finestra aperta — spegnimento ordinato e isolamento fra test. */
    public async flushAll(): Promise<void> {
        for (const eventId of [...this.pending.keys()]) {
            await this.flush(eventId);
        }
    }

    /** Numero di eventi con una finestra aperta — osservabilità e asserzioni di test. */
    public pendingCount(): number {
        return this.pending.size;
    }
}
