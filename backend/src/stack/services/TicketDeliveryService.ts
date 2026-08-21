import { Service } from "fastify-decorators";
import { Event, Ticket } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { readI18nText } from "@utils/helpers/i18nText";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { TicketQrService } from "@services/TicketQrService";
import { MailService } from "@mail/MailService";
import { QrImageService } from "@mail/QrImageService";
import { formatEventDates } from "@mail/templates/format";
import { InlineImage } from "@mail/ports/Mailer";

/** Ciò che serve a consegnare dei biglietti. La forma la impone il servizio. */
export type TicketDeliveryInput = {
    /** Indirizzo di chi ha comprato. */
    to: string;
    firstName: string;
    event: Pick<Event, "title" | "slug" | "startAt" | "endAt">;
    tickets: Ticket[];
    /** Centesimi interi. Zero è un caso normale (accrediti, ingressi gratuiti). */
    total: number;
    /** Da dove arriva la consegna — compare nel log, non nell'email. */
    source: string;
};

/**
 * **La consegna dei biglietti, in un posto solo.**
 *
 * Stessa forma e stessa ragione di `RegistrationNotifierService`: dei biglietti
 * nascono per strade diverse — l'ordine saldato sulla piattaforma, la vendita
 * dichiarata da un negozio esterno — e l'email con i QR appartiene al **fatto**
 * («sono stati emessi dei biglietti e qualcuno li aspetta»), non al percorso che
 * li ha prodotti.
 *
 * Finché viveva dentro `OrderFulfilmentService`, il percorso dei canali esterni
 * era muto: la persona pagava sul negozio e il suo codice d'ingresso restava
 * nel sistema senza raggiungerla mai. È `RF-COM-1` — *«l'email che conta più di
 * tutte le altre messe insieme»* — e nessuna delle due strade può ora
 * dimenticarsene senza che si veda.
 *
 * ── Non lancia, mai ─────────────────────────────────────────────────────────
 * A questo punto i biglietti sono emessi e il denaro è incassato: nessun
 * problema di posta può rendere falso quel fatto, e farlo risalire annullerebbe
 * una vendita riuscita per colpa di un server SMTP.
 */
@Service()
export class TicketDeliveryService {
    constructor(
        private readonly registrationRepository: RegistrationRepository,
        private readonly ticketQrService: TicketQrService,
        private readonly mailService: MailService,
        private readonly qrImageService: QrImageService,
    ) {}

    /** `true` se l'email è stata composta e affidata al mailer. */
    public async deliver(input: TicketDeliveryInput): Promise<boolean> {
        if (!input.to) {
            Log.warn(`[TicketDelivery Service]: no recipient for ${input.source} — ${input.tickets.length} ticket(s) not delivered`);
            return false;
        }
        if (!input.tickets.length) {
            Log.debug(`[TicketDelivery Service]: nothing to deliver for ${input.source}`);
            return false;
        }

        try {
            // I nomi degli intestatari, per distinguere i codici quando la
            // consegna porta più persone. Una lettura sola, non una per biglietto.
            const registrationIds = input.tickets
                .map(ticket => ticket.registrationId)
                .filter((id): id is number => id !== null);
            const registrations = registrationIds.length
                ? await this.registrationRepository.findByIds(registrationIds)
                : [];
            const holderById = new Map(
                registrations.map(r => [r.id, `${r.holderName} ${r.holderSurname}`.trim()]),
            );

            // ── I QR, uno per biglietto ──────────────────────────────────────
            // Il contenuto è il **token firmato**, non il codice: l'app di
            // check-in lo verifica offline con la sola chiave pubblica, e
            // l'operatore alla porta non deve interrogare il server per ogni
            // persona in fila. Se il disegno fallisce si va avanti senza — il
            // codice in chiaro resta, e l'email parte comunque.
            const qrByTicket = new Map<number, string>();
            const inlineImages: InlineImage[] = [];
            for (const ticket of input.tickets) {
                const image = await this.qrImageService.ticketQr(
                    ticket.id,
                    this.ticketQrService.issueToken(ticket),
                );
                if (image) {
                    inlineImages.push(image);
                    qrByTicket.set(ticket.id, image.cid);
                }
            }

            await this.mailService.sendRegistrationConfirmed(
                input.to,
                {
                    firstName: input.firstName,
                    eventTitle: readI18nText(input.event.title) ?? input.event.slug,
                    eventSlug: input.event.slug,
                    eventDates: formatEventDates(input.event.startAt, input.event.endAt),
                    // La location richiederebbe una lettura in più su un percorso
                    // caldo: la scheda dell'evento, linkata nell'email, la porta.
                    venue: null,
                    tickets: input.tickets.map(ticket => ({
                        code: ticket.code,
                        holder: (ticket.registrationId !== null ? holderById.get(ticket.registrationId) : "") ?? "",
                        qrCid: qrByTicket.get(ticket.id),
                    })),
                    total: input.total,
                },
                inlineImages,
            );

            Log.info(
                `[TicketDelivery Service]: delivered ${input.tickets.length} ticket(s) for ${input.source} — `
                + `${inlineImages.length} QR code(s) embedded`,
            );
            return true;
        } catch (err) {
            Log.error(`[TicketDelivery Service]: delivery failed for ${input.source}: ${(err as Error).message}`);
            return false;
        }
    }
}
