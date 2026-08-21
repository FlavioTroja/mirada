import { Service } from "fastify-decorators";
import { Log } from "@utils/adapters/log";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { RegistrationCreatedPayloadDTO } from "@websocket/dtos/RegistrationCreatedPayloadDTO";
import {
    RegistrationChange,
    RegistrationUpdatedPayloadDTO,
} from "@websocket/dtos/RegistrationUpdatedPayloadDTO";

/**
 * **Il segnale `registration/created`, in un posto solo.**
 *
 * Un'iscrizione nasce per due strade diverse: l'inserimento a mano
 * dell'organizzatore (`RegistrationService.create`) e l'acquisto del ballerino
 * (`OrderService.reserve`). La seconda è quella che conta — è l'unica che si
 * usa la sera dell'apertura vendite — ed è proprio quella che restava muta,
 * perché il `publish` viveva dentro il servizio di una delle due.
 *
 * Il segnale appartiene al **fatto** («è nata un'iscrizione»), non al percorso
 * che l'ha prodotto: sta qui, e nessuna delle due strade può dimenticarsene
 * senza che si veda.
 *
 * ── Due regole del §3.9, entrambe non negoziabili ─────────────────────────────
 * 1. **Si pubblica dopo il commit, mai dentro la transazione.** Un frame emesso
 *    da una transazione che poi rotola indietro annuncia un'iscrizione che non
 *    esiste, e il client la va a rileggere trovando un 404.
 * 2. **Uno per uno ai membri dell'organizzazione, mai in broadcast per ruolo.**
 *    Un `broadcastToRoles("ORGANIZER")` raggiungerebbe gli organizzatori di
 *    *tutte* le organizzazioni: la tenancy va rispettata anche sul socket.
 *
 * Il payload porta **soli identificativi**: il WebSocket è un trigger di
 * refetch, non un canale di dati (§3.9).
 */
@Service()
export class RegistrationNotifierService {
    constructor(
        private readonly organizationAudienceService: OrganizationAudienceService,
        private readonly wsPublisher: WsPublisherService,
    ) {}

    /**
     * Annuncia una o più iscrizioni appena scritte. `registrationIds` è un
     * elenco perché un solo acquisto ne crea quante sono le persone del
     * carrello, e il cruscotto deve vederle tutte, non solo la prima.
     *
     * **Non lancia mai.** L'iscrizione a quel punto è già scritta e pagata: la
     * perdita di un trigger di refetch non può farla fallire a posteriori.
     */
    public async registrationsCreated(
        event: { id: number; organizationId: number },
        registrationIds: number[],
    ): Promise<void> {
        if (!registrationIds.length) {
            return;
        }

        try {
            const wsCodes = await this.organizationAudienceService.resolveMemberWsCodes(event.organizationId);
            if (!wsCodes.length) {
                return;
            }

            for (const registrationId of registrationIds) {
                const payload: RegistrationCreatedPayloadDTO = {
                    eventId: event.id,
                    organizationId: event.organizationId,
                    registrationId,
                };
                await this.wsPublisher.sendToUsers(wsCodes, Events.REGISTRATION_CREATED, payload);
            }

            Log.info(
                `[RegistrationNotifier Service]: published 'registration/created' for `
                + `${registrationIds.length} registration(s) on event (id ${event.id}) `
                + `to ${wsCodes.length} member(s)`,
            );
        } catch (err) {
            Log.error(
                `[RegistrationNotifier Service]: failed to publish 'registration/created' for `
                + `registration(s) (id ${registrationIds.join(", ")}): ${(err as Error).message}`,
            );
        }
    }

    /**
     * Annuncia che un'iscrizione **gia esistente** e cambiata: confermata,
     * rifiutata, cancellata, o con il ruolo riassegnato.
     *
     * Sta qui accanto a `registrationsCreated` per la stessa ragione per cui
     * quello ci sta: il segnale appartiene al fatto, non al percorso. Le
     * conferme arrivano da `RegistrationService`, le riassegnazioni di ruolo
     * anche dal trasferimento di biglietto, e nessuna delle due strade puo
     * dimenticarsene senza che si veda.
     *
     * **Non lancia mai**, come il gemello: la modifica e gia scritta.
     */
    public async registrationUpdated(
        event: { id: number; organizationId: number },
        registrationId: number,
        change: RegistrationChange,
    ): Promise<void> {
        try {
            const wsCodes = await this.organizationAudienceService.resolveMemberWsCodes(event.organizationId);
            if (!wsCodes.length) {
                return;
            }

            const payload: RegistrationUpdatedPayloadDTO = {
                eventId: event.id,
                organizationId: event.organizationId,
                registrationId,
                change,
            };
            await this.wsPublisher.sendToUsers(wsCodes, Events.REGISTRATION_UPDATED, payload);

            Log.info(
                `[RegistrationNotifier Service]: published 'registration/updated' (${change}) for registration `
                + `(id ${registrationId}) on event (id ${event.id}) to ${wsCodes.length} member(s)`,
            );
        } catch (err) {
            Log.error(
                `[RegistrationNotifier Service]: publish of 'registration/updated' failed for registration `
                + `(id ${registrationId}): ${(err as Error).message}`,
            );
        }
    }

}
