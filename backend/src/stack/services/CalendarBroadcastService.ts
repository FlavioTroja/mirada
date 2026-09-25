import { Service } from "fastify-decorators";
import { Log } from "@utils/adapters/log";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { CalendarChangedPayloadDTO } from "@websocket/dtos/CalendarChangedPayloadDTO";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";

export type CalendarChangeSource = CalendarChangedPayloadDTO["source"];

/**
 * **Il calendario in tempo reale** — `20-calendario.md`. Quando un collaboratore
 * aggiunge una lezione, gli altri membri che hanno il calendario aperto la
 * vedono comparire senza ricaricare la pagina.
 *
 * Si chiama **dopo** la scrittura, mai dentro la transazione (§3.9), e un errore
 * di trasporto non risale mai: la lezione è salvata comunque, e un socket lento
 * non può disfarla.
 *
 * ── E quando le istanze del backend saranno due ─────────────────────────────
 * Il segnale passa per `WsPublisherService`, cioè per la porta `EventPublisher`.
 * Oggi raggiunge chi è collegato a questo processo, e i processi sono uno. Il
 * giorno in cui saranno più d'uno, il pub/sub fra istanze (Redis) entra
 * nell'adattatore, e questo servizio non cambia.
 */
@Service()
export class CalendarBroadcastService {
    constructor(
        private readonly organizationAudienceService: OrganizationAudienceService,
        private readonly wsPublisher: WsPublisherService,
    ) {}

    /** `spans` = gli intervalli toccati, prima e dopo la modifica: il segnale ne copre l'unione. */
    public async publishChanged(
        organizationId: number,
        source: CalendarChangeSource,
        spans: { startAt: Date; endAt: Date }[],
    ): Promise<void> {
        if (!spans.length) {
            return;
        }
        try {
            const wsCodes = await this.organizationAudienceService.resolveMemberWsCodes(organizationId);
            if (!wsCodes.length) {
                return;
            }
            const payload: CalendarChangedPayloadDTO = {
                organizationId,
                from: new Date(Math.min(...spans.map(s => s.startAt.getTime()))).toISOString(),
                to: new Date(Math.max(...spans.map(s => s.endAt.getTime()))).toISOString(),
                source,
            };
            await this.wsPublisher.sendToUsers(wsCodes, Events.CALENDAR_CHANGED, payload);
            Log.debug(
                `[CalendarBroadcast Service]: 'calendar/changed' (${source}) sent to ${wsCodes.length} member(s) `
                + `of organization (id ${organizationId})`,
            );
        } catch (err) {
            Log.error(
                `[CalendarBroadcast Service]: failed to publish 'calendar/changed' for organization `
                + `(id ${organizationId}): ${(err as Error).message}`,
            );
        }
    }
}
