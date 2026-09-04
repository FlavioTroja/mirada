import { Service } from "fastify-decorators";
import {
    DeclaredDanceRole,
    Event,
    ExternalSale,
    ExternalSaleEvent,
    ExternalSaleEventStatus,
    ExternalSaleStatus,
    EventStatus,
    Prisma,
    RegistrationChannel,
    RegistrationStatus,
    SalesChannel,
    SalesChannelStatus,
    Ticket,
    TicketStatus,
} from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { splitCents } from "@utils/helpers/splitCents";
import { normalizeDepositCode } from "@utils/helpers/depositCode";
import { open } from "@utils/adapters/secretBox";
import { SalesChannelRepository } from "@repositories/SalesChannelRepository";
import { SalesChannelMappingRepository } from "@repositories/SalesChannelMappingRepository";
import { SalesChannelDepositCodeRepository } from "@repositories/SalesChannelDepositCodeRepository";
import { ExternalSaleRepository } from "@repositories/ExternalSaleRepository";
import { ExternalSaleEventRepository } from "@repositories/ExternalSaleEventRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { TicketRepository } from "@repositories/TicketRepository";
import { CapacityEngineService, CommitItem } from "@services/CapacityEngineService";
import { TicketService } from "@services/TicketService";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";
import { SalesChannelAdapterRegistryService } from "@services/SalesChannelAdapterRegistryService";
import { RegistrationNotifierService } from "@services/RegistrationNotifierService";
import { TicketDeliveryService } from "@services/TicketDeliveryService";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { ExternalSaleIngestedPayloadDTO } from "@websocket/dtos/ExternalSaleIngestedPayloadDTO";
import { ExternalSaleQuarantinedPayloadDTO } from "@websocket/dtos/ExternalSaleQuarantinedPayloadDTO";
import {
    CanonicalAttribute,
    CanonicalNotification,
    CanonicalSale,
    ExternalNotificationKind,
    NotificationHeaders,
} from "@interfaces/ExternalSaleChannelAdapter";

/** Esito della ricezione, per il controller e per i test. */
export type ReceiveOutcome = {
    salesChannelId: number;
    externalSaleEventId: number;
    /** True quando la stessa consegna era già stata registrata. */
    duplicate: boolean;
    /** True quando l'elaborazione è stata programmata. */
    scheduled: boolean;
};

/**
 * Chi è, e come balla, **il singolo posto** — per quanto il negozio ne sappia.
 *
 * Un posto ha sempre un'identità: quando il negozio non chiede nulla è quella di
 * chi ha comprato, con ruolo flessibile. Non esiste il caso «non lo so»: sarebbe
 * un'iscrizione senza nominativo alla porta.
 */
type SeatIdentity = {
    declaredRole: DeclaredDanceRole;
    name: string;
    surname: string;
};

/** Una riga d'ordine già tradotta in posti da registrare. */
type ResolvedLine = {
    ticketTypeId: number;
    seats: number;
    title: string;
    /** Una identità per posto, nell'ordine in cui i posti vengono creati. */
    identities: SeatIdentity[];
    /** Prezzo di **listino** della riga, prima di qualunque sconto. */
    listAmount: number;
    /** Il **residuo** di questa riga: quanto i codici di acconto le hanno
     *  scontato, e nient'altro (`14` §4.1). Zero sulle vendite a prezzo pieno. */
    balanceDue: number;
};

/**
 * I quattro numeri dell'acconto per l'intera vendita (`14` §5).
 *
 * `depositPaidAmount` + `balanceDueAmount` non fa `ticketListAmount` quando
 * sull'ordine c'è **anche** uno sconto ordinario: la differenza è proprio quello
 * sconto, ed è la ragione per cui il residuo non si calcola da `total_discounts`
 * (`14` §4.2). Su un pacchetto da €155 con early bird −10% e poi `ACCONTO_30`,
 * la persona paga €41,85 adesso, deve €97,65 alla porta, e avrà pagato €139,50 —
 * non €155, che si riprenderebbe di nascosto l'early bird promesso.
 */
type DepositTally = {
    ticketListAmount: number;
    depositPaidAmount: number;
    balanceDueAmount: number;
    nonTicketDepositAmount: number;
};

/** Lo stato in cui la riga della vendita va scritta. */
type SaleState = {
    status: ExternalSaleStatus;
    eventId: number | null;
    ingestedAt: Date | null;
    quarantineReason: string | null;
    deposit: DepositTally;
};

const NO_DEPOSIT: DepositTally = {
    ticketListAmount: 0,
    depositPaidAmount: 0,
    balanceDueAmount: 0,
    nonTicketDepositAmount: 0,
};

/**
 * L'esito della traduzione. L'**evento** viaggia con le righe e non si rilegge
 * dopo: serve tre volte — per l'impegno, per l'email e per il segnale — e
 * rileggerlo sarebbe tre query per un dato che si aveva già in mano.
 */
type LineResolution = {
    lines: ResolvedLine[];
    event: Event | null;
    reason: string | null;
    deposit: DepositTally;
};

/**
 * # L'ingestione delle vendite esterne — fase E
 *
 * Ciò che accade quando un negozio dell'organizzatore dichiara di aver venduto.
 *
 * ── La regola che governa tutto il servizio ─────────────────────────────────
 * **Una vendita già incassata non può essere rifiutata.** Il denaro si è mosso
 * altrove e Mirada non può disfarlo: l'impegno passa da `commitWithoutBlocking`
 * (`RB20`), che registra il consumo, avvisa se sfora e procede — la stessa
 * strada dell'emissione manuale di pass, e per la stessa ragione. L'invariante
 * `I1` del `05` lo dice già: il consumo che viene dai canali esterni **può**
 * eccedere il limite, ed è informativo e sotto la responsabilità
 * dell'organizzatore.
 *
 * Il contrario del percorso d'acquisto interno, che invece **deve** rifiutare.
 * Sono due contratti opposti sullo stesso motore, ed è la ragione per cui questo
 * servizio esiste separato da `OrderService`.
 *
 * ── Ciò che non può essere tradotto non si perde ────────────────────────────
 * Prodotto non mappato, evento che non gestisce i canali esterni, righe che
 * appartengono a due eventi diversi: la vendita finisce in **quarantena**, con un
 * motivo scritto in italiano, e resta nel back-office con il proprio corpo
 * grezzo. Non fallisce, non sparisce, e la si può rielaborare dopo aver corretto
 * la mappatura. Il giorno dell'apertura vendite è la differenza fra un problema e
 * un disastro.
 *
 * ── Due tempi, e il motivo ──────────────────────────────────────────────────
 * `receive` verifica la firma, registra la notifica e **risponde**. L'elaborazione
 * avviene dopo. Shopify stacca la connessione a cinque secondi e, sopra una certa
 * quota di consegne fallite, smette del tutto di notificare: rispondere in fretta
 * non è un'ottimizzazione, è ciò che tiene vivo il canale.
 */
@Service()
export class ExternalSaleIngestionService {
    constructor(
        private readonly salesChannelRepository: SalesChannelRepository,
        private readonly salesChannelMappingRepository: SalesChannelMappingRepository,
        private readonly salesChannelDepositCodeRepository: SalesChannelDepositCodeRepository,
        private readonly externalSaleRepository: ExternalSaleRepository,
        private readonly externalSaleEventRepository: ExternalSaleEventRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly ticketRepository: TicketRepository,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly ticketService: TicketService,
        private readonly organizationAudienceService: OrganizationAudienceService,
        private readonly adapterRegistry: SalesChannelAdapterRegistryService,
        private readonly registrationNotifierService: RegistrationNotifierService,
        private readonly ticketDeliveryService: TicketDeliveryService,
        private readonly wsPublisher: WsPublisherService,
    ) {}

    // ═════════════════════════════════════════════════════════════════════════
    // 1. La ricezione — `POST /api/sales-channels/webhook/:publicId`
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Verifica, registra, programma, risponde. **Nessuna scrittura di dominio
     * avviene qui dentro.**
     *
     * L'ordine dei controlli non è arbitrario: si risolve il canale prima di
     * verificare la firma perché il segreto è del canale, e si registra la
     * notifica prima di elaborarla perché ciò che non è registrato non si può
     * ritentare.
     */
    public async receive(
        publicId: string,
        rawBody: Buffer,
        headers: NotificationHeaders,
    ): Promise<ReceiveOutcome> {
        const channel = await this.salesChannelRepository.findByPublicId(publicId);
        if (!channel) {
            Log.warn(`[ExternalSaleIngestion Service]: notification refused — no sales channel with public id '${publicId}'`);
            throw new httpErrors.NotFound("Canale di vendita sconosciuto.");
        }

        if (channel.status === SalesChannelStatus.DISABLED) {
            // `410 Gone` e non `404`: al prestatore si sta dicendo «smetti di
            // riprovare», che è un'informazione diversa da «non esiste».
            Log.warn(`[ExternalSaleIngestion Service]: notification refused — sales channel (id ${channel.id}) is DISABLED`);
            throw new httpErrors.Gone("Canale di vendita disconnesso.");
        }

        const adapter = this.adapterRegistry.resolve(channel.provider);

        if (!adapter.verifySignature(rawBody, headers, open(channel.webhookSecret))) {
            Log.warn(`[ExternalSaleIngestion Service]: notification refused on sales channel (id ${channel.id}) — invalid signature`);
            throw new httpErrors.Unauthorized("Firma della notifica non valida.");
        }

        const notification = adapter.readNotification(rawBody, headers);

        const seen = await this.externalSaleEventRepository.findByExternalEventId(
            channel.id,
            notification.externalEventId,
        );
        if (seen) {
            // I webhook sono consegnati **almeno una volta**: la stessa notifica
            // arriva due volte ogni volta che la nostra risposta si perde per
            // strada. È un caso normale e la risposta è `200`, altrimenti il
            // prestatore continuerebbe a riprovare all'infinito.
            Log.info(
                `[ExternalSaleIngestion Service]: delivery '${notification.externalEventId}' on sales channel `
                + `(id ${channel.id}) was already recorded (id ${seen.id}) — nothing to do`,
            );
            return { salesChannelId: channel.id, externalSaleEventId: seen.id, duplicate: true, scheduled: false };
        }

        const eventRow = await this.externalSaleEventRepository.save({
            salesChannelId: channel.id,
            externalEventId: notification.externalEventId,
            topic: notification.topic,
            externalOrderId: notification.externalOrderId,
            payload: JSON.parse(rawBody.toString("utf8")) as Prisma.InputJsonValue,
            status: ExternalSaleEventStatus.RECEIVED,
        });

        Log.info(
            `[ExternalSaleIngestion Service]: recorded delivery '${notification.externalEventId}' (${notification.topic}) `
            + `on sales channel (id ${channel.id}) as external sale event (id ${eventRow.id})`,
        );

        if (channel.status === SalesChannelStatus.PAUSED) {
            // Registrata ma non elaborata: mettere in pausa non deve significare
            // perdere le vendite che arrivano nel frattempo. Riprenderanno con la
            // passata di ripresa quando il canale torna attivo.
            Log.info(`[ExternalSaleIngestion Service]: sales channel (id ${channel.id}) is PAUSED — delivery stored, not processed`);
            return { salesChannelId: channel.id, externalSaleEventId: eventRow.id, duplicate: false, scheduled: false };
        }

        this.schedule(channel, eventRow, notification);

        return { salesChannelId: channel.id, externalSaleEventId: eventRow.id, duplicate: false, scheduled: true };
    }

    /**
     * Programma l'elaborazione fuori dal ciclo della richiesta.
     *
     * `setImmediate` e non un `await`: la risposta al prestatore deve partire
     * prima che si tocchi la capienza. Il `catch` non è cerimonia — un rifiuto
     * non gestito qui **abbatterebbe il processo**, e l'elaborazione registra
     * comunque il proprio esito sulla riga della notifica.
     */
    private schedule(channel: SalesChannel, eventRow: ExternalSaleEvent, notification: CanonicalNotification): void {
        setImmediate(() => {
            void this.process(channel, eventRow, notification).catch(err => {
                Log.error(
                    `[ExternalSaleIngestion Service]: processing of external sale event (id ${eventRow.id}) failed: `
                    + `${(err as Error).message}`,
                );
            });
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 2. L'elaborazione
    // ═════════════════════════════════════════════════════════════════════════

    public async process(
        channel: SalesChannel,
        eventRow: ExternalSaleEvent,
        notification: CanonicalNotification,
    ): Promise<void> {
        try {
            switch (notification.kind) {
                case ExternalNotificationKind.SALE_PAID:
                    await this.ingest(channel, notification.sale!);
                    await this.externalSaleEventRepository.markProcessed(eventRow.id, ExternalSaleEventStatus.PROCESSED, null);
                    return;

                case ExternalNotificationKind.SALE_REVOKED:
                    await this.revoke(channel, notification);
                    return;

                default:
                    Log.info(
                        `[ExternalSaleIngestion Service]: delivery '${notification.topic}' on sales channel (id ${channel.id}) `
                        + "carries no consequence — recorded and archived",
                    );
                    await this.externalSaleEventRepository.markProcessed(eventRow.id, ExternalSaleEventStatus.IGNORED, null);
            }
        } catch (err) {
            const message = (err as Error).message;
            Log.error(
                `[ExternalSaleIngestion Service]: external sale event (id ${eventRow.id}) on sales channel `
                + `(id ${channel.id}) failed: ${message}`,
            );
            await this.externalSaleEventRepository.markProcessed(eventRow.id, ExternalSaleEventStatus.FAILED, message);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 3. L'ingestione vera
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Registra la vendita: iscrizioni, capienza, biglietti. In **una**
     * transazione, con il segnale WebSocket **dopo** il commit (§3.9).
     *
     * L'ordine dei passi ricalca `PassIssuanceService.issueBulk`, che è il
     * parente più prossimo: una iscrizione per posto, un biglietto per
     * iscrizione, e l'impegno non bloccante **in coda**, perché è ciò che
     * `commitWithoutBlocking` si aspetta — iscrizioni già esistenti a cui
     * agganciare i consumi.
     */
    public async ingest(channel: SalesChannel, sale: CanonicalSale): Promise<ExternalSale> {
        const existing = await this.externalSaleRepository.findByExternalOrder(channel.id, sale.externalOrderId);
        if (existing && existing.status === ExternalSaleStatus.INGESTED) {
            Log.info(
                `[ExternalSaleIngestion Service]: external order ${sale.externalOrderId} on sales channel (id ${channel.id}) `
                + `is already ingested as external sale (id ${existing.id}) — idempotent replay, nothing done`,
            );
            return existing;
        }

        const resolution = await this.resolveLines(channel, sale);
        if (resolution.reason) {
            return this.quarantine(channel, sale, resolution.reason, existing);
        }

        // Ordine di sole magliette: non è un errore e non deve chiedere nulla a
        // nessuno. Si registra, così la riconciliazione non lo riesamina ogni
        // volta, e si tace.
        if (!resolution.lines.length || !resolution.event) {
            Log.info(
                `[ExternalSaleIngestion Service]: external order ${sale.externalOrderId} on sales channel (id ${channel.id}) `
                + "carries no ticket line — recorded without registrations",
            );
            if (resolution.deposit.nonTicketDepositAmount > 0) {
                // Codice di acconto su un ordine senza righe biglietto (`14` §9).
                // Nessun residuo — non c'è nessuno che si presenterà alla porta —
                // ma è un fatto che l'organizzatore deve vedere.
                Log.warn(
                    `[ExternalSaleIngestion Service]: external order ${sale.externalOrderId} carries a deposit code `
                    + `on non-ticket lines only (${resolution.deposit.nonTicketDepositAmount} cents) — no balance created`,
                );
            }

            return this.upsertSale(channel, sale, {
                status: ExternalSaleStatus.INGESTED,
                eventId: null,
                ingestedAt: new Date(),
                quarantineReason: null,
                deposit: resolution.deposit,
            }, existing);
        }

        const event = resolution.event;
        const totalSeats = resolution.lines.reduce((sum, line) => sum + line.seats, 0);

        Log.info(
            `[ExternalSaleIngestion Service]: ingesting external order ${sale.externalOrderId} on sales channel `
            + `(id ${channel.id}) — event (id ${event.id}), ${resolution.lines.length} ticket line(s), ${totalSeats} seat(s)`,
        );

        const outcome = await getPrismaClient().$transaction(async prisma => {
            const externalSale = await this.persistSale(channel, sale, {
                status: ExternalSaleStatus.RECEIVED,
                eventId: event.id,
                ingestedAt: null,
                quarantineReason: null,
                deposit: resolution.deposit,
            }, existing, prisma);

            const items: CommitItem[] = [];
            const tickets: Ticket[] = [];

            for (const line of resolution.lines) {
                // ── La ripartizione fra i posti (`14` §4.5, `RB28`) ───────────
                // Il residuo della riga si divide per i posti che quella riga
                // vale, in centesimi interi, e il resto va ai primi. La somma
                // delle quote è **esattamente** il residuo della riga: è
                // l'invariante, e `splitCents` esiste solo per garantirla.
                const shares = splitCents(line.balanceDue, line.seats);

                for (let seat = 0; seat < line.seats; seat += 1) {
                    const identity = line.identities[seat]!;
                    // Una iscrizione per posto: è la persona nell'evento, ed è
                    // ciò a cui i consumi di capienza si agganciano.
                    //
                    // ── Il ruolo di ballo, e chi occupa il posto ────────────
                    // Il negozio li conosce **solo se li ha chiesti** al
                    // checkout, e allora arrivano con il nome del campo che
                    // l'organizzatore ha configurato sul canale. Quando non li
                    // chiede, `FLEXIBLE` e il nominativo dell'acquirente non
                    // sono un ripiego: sono la verità di questo momento. Il
                    // motore risolve il ruolo flessibile in quello più scarso
                    // invece di lasciare l'iscrizione senza (invariante `I4`), e
                    // `CapacityEngineService.reassignRole` correggerà quando il
                    // ruolo vero si saprà. Fino ad allora l'equilibrio
                    // leader/follower è **provvisorio**, e il cruscotto lo dice.
                    //
                    // L'indirizzo resta quello dell'acquirente anche sui posti
                    // intestati ad altri: è l'unico che il negozio ha visto, ed
                    // è a lui che i biglietti sono stati mandati.
                    //
                    // ⚠️ **E per questo qui NON si censisce** (`16` §3), benché
                    // sia una via non-online come quelle che censiscono. Su una
                    // vendita di tre pass `holderEmail` è la stessa per tutti e
                    // tre: risolverla in anagrafica darebbe lo stesso `personId`
                    // a tre iscrizioni dello stesso evento, e la seconda
                    // violerebbe `@@unique([eventId, personId])` — cioè una
                    // vendita già incassata verrebbe rifiutata, che è la sola
                    // cosa che l'ingestione non deve mai fare. L'anagrafica di
                    // chi occupa davvero quel posto si saprà alla porta, non qui.
                    const registration = await this.registrationRepository.save(
                        {
                            eventId: event.id,
                            externalSaleId: externalSale.id,
                            holderName: identity.name,
                            holderSurname: identity.surname,
                            holderEmail: sale.buyerEmail,
                            declaredRole: identity.declaredRole,
                            channel: RegistrationChannel.EXTERNAL_CHANNEL,
                            // La vendita è incassata: l'iscrizione è confermata.
                            // Ciò che manca è il ruolo, non il pagamento.
                            status: RegistrationStatus.CONFIRMED,
                            confirmedAt: sale.paidAt ?? new Date(),
                            // La quota di residuo **di questa persona**. Zero su
                            // ogni vendita a prezzo pieno, che sono la norma.
                            balanceDueAmount: shares[seat] ?? 0,
                        },
                        prisma,
                    );

                    tickets.push(await this.ticketService.issue(
                        {
                            eventId: event.id,
                            ticketTypeId: line.ticketTypeId,
                            registrationId: registration.id,
                            externalSaleId: externalSale.id,
                            holderName: identity.name,
                            holderSurname: identity.surname,
                            holderEmail: sale.buyerEmail,
                            // Nominale, non al portatore: un titolare c'è —
                            // l'acquirente — ed è a lui che si scrive per farsi
                            // dire i nomi veri degli altri posti.
                            bearer: false,
                        },
                        prisma,
                    ));

                    items.push({ registrationId: registration.id, ticketTypeId: line.ticketTypeId, quantity: 1 });
                }
            }

            // `RB20` — impegno **non bloccante**: si registra e si avvisa.
            const capacity = await this.capacityEngineService.commitWithoutBlocking(event.id, items, prisma);

            const ingested = await this.externalSaleRepository.update(
                { id: externalSale.id },
                { status: ExternalSaleStatus.INGESTED, ingestedAt: new Date() },
                undefined,
                undefined,
                prisma,
            );

            return {
                sale: ingested,
                warnings: capacity.warnings,
                tickets,
                registrationIds: items.map(item => item.registrationId),
            };
        });

        Log.info(
            `[ExternalSaleIngestion Service]: external sale (id ${outcome.sale.id}) ingested — `
            + `${outcome.registrationIds.length} registration(s) on event (id ${event.id}), `
            + `${outcome.warnings.length} capacity warning(s), nothing blocked (RB20)`,
        );

        if (resolution.deposit.balanceDueAmount > 0) {
            Log.info(
                `[ExternalSaleIngestion Service]: external sale (id ${outcome.sale.id}) opened a balance of `
                + `${resolution.deposit.balanceDueAmount} cents across ${outcome.registrationIds.length} registration(s) — `
                + "to be collected at the box office",
            );
        }
        if (resolution.deposit.nonTicketDepositAmount > 0) {
            // Si SEGNALA, non si mette in quarantena: la vendita è legittima e
            // incassata, e una vendita già incassata non si rifiuta (`14` §4.4).
            Log.warn(
                `[ExternalSaleIngestion Service]: external sale (id ${outcome.sale.id}) had `
                + `${resolution.deposit.nonTicketDepositAmount} cents of deposit discount falling on non-ticket lines — `
                + "not part of the balance; check that the deposit code is limited to ticket products on the shop",
            );
        }

        // ── Tutto ciò che segue avviene DOPO il commit, e nulla di ciò che
        // segue può farlo rotolare indietro ────────────────────────────────
        // Vale per i due segnali (§3.9) e vale, per la ragione rovesciata, per
        // l'email: una transazione che rotolasse indietro dopo l'invio
        // lascerebbe in mano a qualcuno il biglietto di un'iscrizione che non
        // esiste, e un'email non si richiama indietro.
        await this.notifyIngested(channel, outcome.sale, outcome.registrationIds.length);
        await this.registrationNotifierService.registrationsCreated(event, outcome.registrationIds);
        await this.deliverTickets(sale, event, outcome.tickets, resolution.deposit);

        return outcome.sale;
    }

    /**
     * `RF-COM-1` — l'email con i biglietti, all'**acquirente del negozio**.
     *
     * Senza, la persona paga su Shopify e il suo codice d'ingresso resta qui
     * dentro senza raggiungerla mai: il biglietto esiste, il QR è valido, e non
     * ce l'ha nessuno. È il difetto che si presenta all'ingresso sotto forma di
     * una persona che ha pagato e non ha nulla da mostrare.
     *
     * L'importo è quello **incassato dal negozio**, e nell'email compare come
     * totale: è la cifra che l'acquirente riconosce, ed è l'unica che abbia visto.
     */
    private async deliverTickets(
        sale: CanonicalSale,
        event: Event,
        tickets: Ticket[],
        deposit: DepositTally,
    ): Promise<void> {
        await this.ticketDeliveryService.deliver({
            to: sale.buyerEmail,
            firstName: sale.buyerName,
            event,
            tickets,
            total: sale.totalAmount,
            // Con un acconto, `totalAmount` è la sola cifra incassata dal negozio:
            // senza il residuo accanto, l'email direbbe a qualcuno che ha pagato
            // quando non ha finito di pagare (`14` §8).
            balanceDue: deposit.balanceDueAmount,
            // Chi ha comprato in inglese sul negozio riceve il biglietto in
            // inglese: la lingua l'ha già dichiarata al checkout, e l'indirizzo
            // email non dice nulla al riguardo.
            locale: sale.locale,
            source: `external sale ${sale.externalOrderId}`,
        });
    }

    /**
     * Traduce le righe del negozio in posti da registrare.
     *
     * Tre esiti, e la differenza fra i primi due è la ragione per cui esiste la
     * colonna `ticketTypeId` nullable sulla mappatura:
     *  - **nessuna mappatura** → non so cosa sia → quarantena;
     *  - **mappatura senza titolo** → so cos'è, non è un biglietto → ignorata;
     *  - **mappatura con titolo** → tanti posti quanti `quantity × seatsPerUnit`.
     */
    private async resolveLines(channel: SalesChannel, sale: CanonicalSale): Promise<LineResolution> {
        const lines: ResolvedLine[] = [];
        const events = new Map<number, Event>();

        // Una lettura sola per vendita: i codici sono pochi e non cambiano
        // durante l'ingestione di un ordine.
        const depositCodes = await this.depositCodesOf(channel);
        const deposit: DepositTally = { ...NO_DEPOSIT };

        // ── I campi del checkout, se il negozio li raccoglie ─────────────────
        // Gli attributi dell'ordine descrivono **chi ha comprato**: si applicano
        // al primo posto, non a tutti. Un carrello ha un solo insieme di
        // attributi, e spalmarlo su tre pass produrrebbe tre persone con lo
        // stesso nome e lo stesso ruolo — cioè un equilibrio leader/follower
        // falso, che è peggio di uno mancante.
        const orderRoles = this.valuesOf(sale.attributes, channel.roleAttributeName);
        const orderNames = this.valuesOf(sale.attributes, channel.attendeeNameAttributeName);
        let seatIndex = 0;

        for (const line of sale.lines) {
            const mapping = await this.salesChannelMappingRepository.resolve(
                channel.id,
                line.externalProductId,
                line.externalVariantId,
            );

            if (!mapping) {
                return {
                    lines: [],
                    event: null,
                    deposit: NO_DEPOSIT,
                    reason: `L'articolo «${line.title}» non è associato ad alcun titolo d'ingresso. `
                        + "Associalo nella configurazione del canale, poi rielabora la vendita.",
                };
            }

            const discounted = this.depositOfLine(line, depositCodes);

            if (!mapping.ticketTypeId || !mapping.ticketType) {
                Log.debug(
                    `[ExternalSaleIngestion Service]: line '${line.title}' of external order ${sale.externalOrderId} `
                    + "is mapped to no ticket type — deliberately ignored",
                );
                // ── La merce resta fuori dal residuo (`14` §4.4, `RF-SAL-4`) ──
                // Se il codice di acconto ha scontato anche la maglietta, quella
                // fetta NON è un saldo: alla porta nessuno chiede il saldo di una
                // maglietta già consegnata. Si registra e si segnala — quasi
                // sempre significa che il codice, sul negozio, non è limitato ai
                // soli pacchetti, ed è una cosa che l'organizzatore vuole sapere.
                deposit.nonTicketDepositAmount += discounted.deposit;
                continue;
            }

            const event = mapping.ticketType.event;
            events.set(event.id, event);

            const seats = line.quantity * mapping.seatsPerUnit;
            const lineRoles = this.valuesOf(line.attributes, channel.roleAttributeName);
            const lineNames = this.valuesOf(line.attributes, channel.attendeeNameAttributeName);

            const identities: SeatIdentity[] = [];
            for (let seat = 0; seat < seats; seat += 1) {
                // La riga vince sull'ordine: una proprietà scritta sul prodotto
                // riguarda quel prodotto, un attributo del carrello riguarda il
                // carrello. E l'attributo del carrello vale **solo per il primo
                // posto**, che è quello dell'acquirente.
                const rawRole = lineRoles[seat] ?? (seatIndex === 0 ? orderRoles[0] : undefined);
                const rawName = lineNames[seat] ?? (seatIndex === 0 ? orderNames[0] : undefined);
                identities.push(this.seatIdentity(sale, rawRole, rawName));
                seatIndex += 1;
            }

            const listAmount = line.unitPrice * line.quantity;
            deposit.ticketListAmount += listAmount;
            deposit.balanceDueAmount += discounted.deposit;
            // Ciò che il negozio ha davvero incassato su questa riga: il listino
            // meno TUTTI gli sconti, acconto compreso.
            deposit.depositPaidAmount += listAmount - discounted.total;

            lines.push({
                ticketTypeId: mapping.ticketTypeId,
                seats,
                title: line.title,
                identities,
                listAmount,
                balanceDue: discounted.deposit,
            });
        }

        // ── Un ordine, un evento ────────────────────────────────────────────
        // Un carrello che attraversa due eventi produrrebbe due vendite, due
        // impegni di capienza e due notifiche, tutte agganciate a un solo
        // `externalOrderId` — e l'idempotenza, che è per ordine, smetterebbe di
        // proteggere. Finché non esiste un caso reale, è una quarantena.
        if (events.size > 1) {
            return {
                lines: [],
                event: null,
                deposit: NO_DEPOSIT,
                reason: `L'ordine contiene titoli di ${events.size} eventi diversi. `
                    + "Mirada registra una vendita esterna per evento: separa l'ordine sul negozio, oppure "
                    + "registra i posti a mano.",
            };
        }

        const event = [...events.values()][0] ?? null;
        if (event) {
            const refusal = this.eventRefusal(event);
            if (refusal) {
                return { lines: [], event: null, deposit: NO_DEPOSIT, reason: refusal };
            }
        }

        if (deposit.balanceDueAmount > 0 || deposit.nonTicketDepositAmount > 0) {
            Log.info(
                `[ExternalSaleIngestion Service]: external order ${sale.externalOrderId} carries a deposit — `
                + `list ${deposit.ticketListAmount}, paid ${deposit.depositPaidAmount}, `
                + `balance due ${deposit.balanceDueAmount}, off-ticket ${deposit.nonTicketDepositAmount} (cents)`,
            );
        }

        return { lines, event, deposit, reason: null };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 3-bis. L'acconto — `14`
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * La forma canonica di una vendita **con gli sconti**, anche quando quella
     * salvata non li ha (`14` §3.6).
     *
     * ── Il caso che risolve ─────────────────────────────────────────────────
     * Le vendite messe in quarantena prima di questa funzione hanno un
     * `canonicalPayload` scritto da un adapter che gli sconti li buttava via.
     * Rielaborarle così com'erano vorrebbe dire ingerirle come vendite a prezzo
     * pieno: nessun residuo, e al botteghino nessuno chiede il saldo — cioè
     * esattamente il difetto che tutto questo lavoro esiste per chiudere, in
     * agguato proprio sulle vendite che qualcuno aveva già dovuto sbloccare a
     * mano.
     *
     * Il rimedio è il corpo grezzo, ed è il motivo per cui `ExternalSaleEvent`
     * lo conserva. Quando non c'è più — storico ripulito, vendita nata dalla
     * riconciliazione — si procede con ciò che si ha: meglio una vendita
     * ingerita senza residuo che una vendita che non entra.
     */
    public async hydrateDiscounts(channel: SalesChannel, sale: ExternalSale): Promise<CanonicalSale> {
        const canonical = sale.canonicalPayload as unknown as CanonicalSale;

        const complete = (canonical.lines ?? []).every(line => Array.isArray(line.discounts));
        if (complete) {
            return canonical;
        }

        const adapter = this.adapterRegistry.resolve(channel.provider);
        const notifications = await this.externalSaleEventRepository.findByExternalOrder(
            channel.id,
            sale.externalOrderId,
        );

        for (const notification of notifications) {
            // Le notifiche dello stesso ordine sono più d'una e non tutte sono
            // ordini: un rimborso, per esempio. `readSale` risponde `null` su
            // quelle, e si passa alla successiva.
            const rebuilt = adapter.readSale(notification.payload);
            if (!rebuilt || rebuilt.externalOrderId !== sale.externalOrderId) {
                continue;
            }

            Log.info(
                `[ExternalSaleIngestion Service]: external sale (id ${sale.id}) had a canonical payload without `
                + `discounts — rebuilt from raw delivery (id ${notification.id})`,
            );
            return rebuilt;
        }

        Log.warn(
            `[ExternalSaleIngestion Service]: external sale (id ${sale.id}) has a canonical payload without discounts `
            + "and no raw delivery to rebuild from — reprocessed as a full-price sale, any deposit will be missed",
        );
        return canonical;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 3-ter. Ciò che il negozio ha chiesto al checkout
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * I valori di un campo del checkout, **nell'ordine in cui il negozio li
     * consegna**.
     *
     * Lo stesso nome ripetuto è ciò che permette a una riga da tre posti di
     * portare tre nominativi; il confronto è normalizzato perché il nome del
     * campo lo scrive un umano nel modulo del negozio, e «Ruolo» e «ruolo » sono
     * lo stesso campo — con la stessa conseguenza muta che ha insegnato
     * `RF-SAL-2`: nessun errore, e il dato semplicemente non arriva.
     *
     * `configured` nullo significa «questo negozio non lo chiede»: nessun valore,
     * e nessun confronto da fare.
     */
    private valuesOf(attributes: CanonicalAttribute[] | undefined, configured: string | null): string[] {
        if (!configured?.trim() || !attributes?.length) {
            return [];
        }

        const wanted = normalizeDepositCode(configured);
        return attributes
            .filter(attribute => normalizeDepositCode(attribute.name) === wanted)
            .map(attribute => attribute.value.trim())
            .filter(Boolean);
    }

    /**
     * L'identità di un posto: quella dichiarata al checkout, o quella
     * dell'acquirente.
     *
     * ── La ricaduta non è un ripiego, è la verità di quel momento ────────────
     * Il negozio non chiede il ruolo, oppure lo chiede e quella persona non ha
     * risposto: `FLEXIBLE` dice esattamente questo, e il motore di capienza lo
     * risolve nel ruolo più scarso invece di lasciare l'iscrizione senza (che
     * l'invariante `I4` vieta). Lo stesso vale per il nominativo: il posto resta
     * intestato a chi ha comprato, che è l'unica persona di cui si conosca il
     * nome.
     */
    private seatIdentity(sale: CanonicalSale, rawRole?: string, rawName?: string): SeatIdentity {
        const declaredRole = this.parseRole(rawRole);
        if (!rawName) {
            return { declaredRole, name: sale.buyerName, surname: sale.buyerSurname };
        }

        // Un campo di testo libero porta «Maria Rossi», non due colonne: il primo
        // pezzo è il nome, il resto il cognome. Con un pezzo solo il cognome
        // resta da chiedere — e si scrive così, invece di prendere in prestito
        // quello dell'acquirente, che sarebbe una parentela inventata.
        const parts = rawName.split(/\s+/).filter(Boolean);
        return {
            declaredRole,
            name: parts[0] ?? sale.buyerName,
            surname: parts.slice(1).join(" ") || "—",
        };
    }

    /**
     * Il ruolo di ballo, come lo scrive chi compila il modulo del negozio.
     *
     * ── Ciò che NON si accetta, ed è deliberato ─────────────────────────────
     * Non esiste alcuna corrispondenza fra genere e ruolo: «uomo» non significa
     * leader e «donna» non significa follower. In una milonga è falso nel merito
     * — le coppie si formano come vogliono — e sarebbe un difetto che si vede
     * alla porta, con una persona mandata dalla parte sbagliata della sala.
     *
     * Un valore che non si riconosce **non si indovina**: diventa `FLEXIBLE` e
     * lascia una riga nel registro. Il motore assegnerà il ruolo più scarso,
     * che è ciò che sarebbe successo se il campo non ci fosse.
     */
    private parseRole(raw?: string): DeclaredDanceRole {
        if (!raw) {
            return DeclaredDanceRole.FLEXIBLE;
        }

        const value = normalizeDepositCode(raw);
        if (["LEADER", "LEAD", "CONDUCE", "CONDUTTORE", "GUIDA"].includes(value)) {
            return DeclaredDanceRole.LEADER;
        }
        if (["FOLLOWER", "FOLLOW", "SEGUE", "SEGUACE"].includes(value)) {
            return DeclaredDanceRole.FOLLOWER;
        }
        if (["FLEXIBLE", "FLESSIBILE", "ENTRAMBI", "INDIFFERENTE", "BOTH", "ANY"].includes(value)) {
            return DeclaredDanceRole.FLEXIBLE;
        }

        Log.warn(
            `[ExternalSaleIngestion Service]: dance role '${raw}' from the shop is not recognised — `
            + "the seat stays FLEXIBLE and the engine assigns the scarcest role",
        );
        return DeclaredDanceRole.FLEXIBLE;
    }

    /**
     * I codici che, su questo canale, significano «acconto». Già normalizzati in
     * colonna: qui si normalizza l'altra metà del confronto (`RF-SAL-2`).
     */
    private async depositCodesOf(channel: SalesChannel): Promise<Set<string>> {
        const codes = await this.salesChannelDepositCodeRepository.findByChannel(channel.id);
        return new Set(codes.map(row => normalizeDepositCode(row.code)));
    }

    /**
     * Quanto questa riga ha di sconto in tutto, e quanto gliene ha fatto **un
     * codice di acconto**.
     *
     * ── Un codice sconosciuto è uno sconto, non un errore (`14` §3.3) ────────
     * Early bird, coupon, promozione: una riga scontata con un codice che non è
     * configurato come acconto è una vendita scontata normale, e non genera
     * residuo né quarantena. Mandare in quarantena ogni sconto significherebbe
     * mandarci mezza campagna vendite, e la quarantena smetterebbe di voler dire
     * «qualcosa non va» — che è l'unica cosa che deve voler dire.
     */
    private depositOfLine(
        line: { discounts?: { code: string; amount: number }[] },
        depositCodes: Set<string>,
    ): { total: number; deposit: number } {
        // `?? []` e non `.discounts`: le vendite messe in quarantena PRIMA di
        // questa funzione hanno un `canonicalPayload` senza sconti, e vengono
        // rielaborate così come sono. Trattarle come «nessuno sconto» è la
        // risposta giusta — `hydrateDiscounts` le riporta al corpo grezzo prima
        // di arrivare qui, quando quel corpo esiste ancora.
        const discounts = line.discounts ?? [];

        let total = 0;
        let deposit = 0;
        for (const discount of discounts) {
            total += discount.amount;
            if (depositCodes.has(normalizeDepositCode(discount.code))) {
                deposit += discount.amount;
            }
        }

        return { total, deposit };
    }

    /**
     * L'evento accetta vendite da canali esterni?
     *
     * `manageExternalChannels` è l'interruttore per evento che il `05` §5
     * dichiara da sempre: *«la gestione è facoltativa per evento»*. Ingerire su
     * un evento che non l'ha acceso significherebbe far comparire iscritti che
     * l'organizzatore non si aspetta, e sfalsare contatori che stava leggendo.
     */
    private eventRefusal(event: Event): string | null {
        if (!event.manageExternalChannels) {
            return `L'evento «${event.slug}» non gestisce i canali di vendita esterni. `
                + "Attiva la gestione sull'evento, poi rielabora la vendita.";
        }
        if (event.status === EventStatus.CANCELLED) {
            return `L'evento «${event.slug}» è annullato: la vendita va rimborsata sul negozio.`;
        }
        if (event.status === EventStatus.DRAFT) {
            return `L'evento «${event.slug}» è ancora in bozza. Pubblicalo, poi rielabora la vendita.`;
        }
        return null;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 4. La quarantena
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Registra la vendita **senza toccare la capienza** e chiama qualcuno.
     *
     * Il corpo grezzo resta sulla riga: è ciò che permette di rielaborarla dopo
     * aver corretto la mappatura, senza dover chiedere di nuovo l'ordine al
     * negozio — e senza dipendere dal fatto che il negozio risponda.
     */
    private async quarantine(
        channel: SalesChannel,
        sale: CanonicalSale,
        reason: string,
        existing: ExternalSale | null,
    ): Promise<ExternalSale> {
        Log.warn(
            `[ExternalSaleIngestion Service]: external order ${sale.externalOrderId} on sales channel (id ${channel.id}) `
            + `QUARANTINED — ${reason}`,
        );

        const row = await this.upsertSale(channel, sale, {
            status: ExternalSaleStatus.QUARANTINED,
            eventId: null,
            ingestedAt: null,
            quarantineReason: reason,
            // Una vendita che non si è saputa tradurre non ha residuo: i numeri
            // si scriveranno alla rielaborazione, quando le righe avranno un
            // titolo e si saprà quali di esse sono biglietti.
            deposit: NO_DEPOSIT,
        }, existing);

        await this.notifyQuarantined(channel, row, reason);
        return row;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 5. La revoca — rimborsi e annullamenti
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Rilascia la capienza e invalida i biglietti di una vendita rimborsata o
     * annullata sul negozio.
     *
     * Non è una rifinitura da fase successiva: un QR che apre ancora la porta
     * dopo un rimborso è il difetto che si scopre in fila all'ingresso, quando
     * non c'è più tempo per nulla.
     *
     * ── I rimborsi PARZIALI non sono automatizzati ──────────────────────────
     * Limite dichiarato del primo taglio. Shopify non dice quali *posti* sono
     * stati rimborsati: dice quali righe d'ordine e per quale quantità, e la
     * corrispondenza fra una riga d'ordine e i biglietti che ne sono nati la
     * conosce solo Mirada. Sceglierne alcuni «a caso» annullerebbe il biglietto
     * della persona sbagliata — l'errore peggiore possibile qui. La notifica
     * resta quindi registrata come `FAILED` con il motivo, e l'organizzatore
     * annulla i biglietti giusti dal back-office.
     */
    private async revoke(channel: SalesChannel, notification: CanonicalNotification): Promise<void> {
        if (!notification.externalOrderId) {
            Log.warn(`[ExternalSaleIngestion Service]: revocation on sales channel (id ${channel.id}) carries no external order id`);
            throw new httpErrors.BadRequest("Notifica di rimborso priva del riferimento all'ordine.");
        }

        const sale = await this.externalSaleRepository.findByExternalOrder(channel.id, notification.externalOrderId);
        if (!sale) {
            // Rimborso di un ordine che non era una vendita di biglietti — una
            // maglietta, per esempio. Non è un errore.
            Log.info(
                `[ExternalSaleIngestion Service]: revocation of external order ${notification.externalOrderId} on sales `
                + `channel (id ${channel.id}) matches no ingested sale — nothing to release`,
            );
            return;
        }

        if (sale.status !== ExternalSaleStatus.INGESTED) {
            Log.info(
                `[ExternalSaleIngestion Service]: external sale (id ${sale.id}) is ${sale.status} — revocation is a no-op`,
            );
            return;
        }

        const registrations = await this.registrationRepository.findMany(
            { externalSaleId: sale.id, deleted: false },
            { orderBy: { id: "asc" } },
        );

        Log.info(
            `[ExternalSaleIngestion Service]: revoking external sale (id ${sale.id}) — releasing ${registrations.length} `
            + "registration(s) and invalidating their tickets",
        );

        // ── Un saldo già incassato non si disfa (`14` §9) ────────────────────
        // Il residuo si chiude insieme alla vendita, ma le righe di incasso
        // restano dove sono: quei soldi qualcuno li ha davvero presi in mano, e
        // la restituzione avviene fuori piattaforma. Si segnala, non si inventa
        // un rimborso che Mirada non può eseguire.
        const settled = registrations.reduce((sum, row) => sum + row.balanceSettledAmount, 0);
        if (settled > 0) {
            Log.warn(
                `[ExternalSaleIngestion Service]: external sale (id ${sale.id}) is being revoked but ${settled} cents `
                + "of balance were already collected at the box office — the refund of that amount happens off-platform",
            );
        }

        await getPrismaClient().$transaction(async prisma => {
            for (const registration of registrations) {
                await this.capacityEngineService.release(registration.id, prisma);
                await this.registrationRepository.update(
                    { id: registration.id },
                    {
                        status: RegistrationStatus.DECLINED,
                        declinedAt: new Date(),
                        // Nessuno si presenterà a questa porta: il residuo si
                        // chiude, e smette di comparire nei totali del
                        // cruscotto e nelle liste della serata.
                        balanceDueAmount: 0,
                    },
                    undefined,
                    undefined,
                    prisma,
                );
            }

            const tickets = await this.ticketRepository.findMany(
                { externalSaleId: sale.id, deleted: false },
                { orderBy: { id: "asc" } },
                prisma,
            );
            for (const ticket of tickets) {
                await this.ticketRepository.update(
                    { id: ticket.id },
                    { status: TicketStatus.REFUNDED, qrRevokedAt: new Date() },
                    undefined,
                    undefined,
                    prisma,
                );
            }

            await this.externalSaleRepository.update(
                { id: sale.id },
                { status: ExternalSaleStatus.REFUNDED, refundedAt: new Date() },
                undefined,
                undefined,
                prisma,
            );
        });

        Log.info(
            `[ExternalSaleIngestion Service]: external sale (id ${sale.id}) revoked — capacity released, `
            + "QR codes invalidated, open balances closed",
        );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Scritture e segnali
    // ═════════════════════════════════════════════════════════════════════════

    private async upsertSale(
        channel: SalesChannel,
        sale: CanonicalSale,
        state: SaleState,
        existing: ExternalSale | null,
    ): Promise<ExternalSale> {
        return this.persistSale(channel, sale, state, existing);
    }

    private async persistSale(
        channel: SalesChannel,
        sale: CanonicalSale,
        state: SaleState,
        existing: ExternalSale | null,
        tx?: Prisma.TransactionClient,
    ): Promise<ExternalSale> {
        const data = {
            eventId: state.eventId,
            status: state.status,
            externalOrderNumber: sale.externalOrderNumber,
            buyerName: sale.buyerName,
            buyerSurname: sale.buyerSurname,
            buyerEmail: sale.buyerEmail,
            externalCustomerId: sale.externalCustomerId,
            customerLocale: sale.locale,
            totalAmount: sale.totalAmount,
            currency: sale.currency,
            canonicalPayload: sale as unknown as Prisma.InputJsonValue,
            quarantineReason: state.quarantineReason,
            ingestedAt: state.ingestedAt,
            ...state.deposit,
        };

        if (existing) {
            return this.externalSaleRepository.update({ id: existing.id }, data, undefined, undefined, tx);
        }

        return this.externalSaleRepository.save(
            {
                ...data,
                salesChannelId: channel.id,
                externalOrderId: sale.externalOrderId,
                receivedAt: new Date(),
            },
            tx,
        );
    }

    /**
     * `external-sale/ingested` — ai soli membri dell'organizzazione proprietaria,
     * risolti uno per uno. Mai `broadcastToRoles`: le vendite di un organizzatore
     * non sono affari di ogni `OWNER` della piattaforma (§1.5, §3.9).
     *
     * Un errore di trasporto non risale **mai** a una vendita già registrata:
     * i biglietti sono emessi, e un socket lento non può disfarli.
     */
    private async notifyIngested(channel: SalesChannel, sale: ExternalSale, seats: number): Promise<void> {
        if (!sale.eventId) {
            return;
        }

        const payload: ExternalSaleIngestedPayloadDTO = {
            externalSaleId: sale.id,
            salesChannelId: channel.id,
            channelLabel: channel.label,
            eventId: sale.eventId,
            organizationId: channel.organizationId,
            seats,
            externalOrderNumber: sale.externalOrderNumber,
        };

        try {
            const wsCodes = await this.organizationAudienceService.resolveMemberWsCodes(channel.organizationId);
            if (!wsCodes.length) {
                return;
            }
            await this.wsPublisher.sendToUsers(wsCodes, Events.EXTERNAL_SALE_INGESTED, payload);
            Log.info(
                `[ExternalSaleIngestion Service]: published 'external-sale/ingested' for external sale (id ${sale.id}) `
                + `to ${wsCodes.length} member(s) of organization (id ${channel.organizationId})`,
            );
        } catch (err) {
            Log.error(`[ExternalSaleIngestion Service]: publish failed for external sale (id ${sale.id}): ${(err as Error).message}`);
        }
    }

    private async notifyQuarantined(channel: SalesChannel, sale: ExternalSale, reason: string): Promise<void> {
        const payload: ExternalSaleQuarantinedPayloadDTO = {
            externalSaleId: sale.id,
            salesChannelId: channel.id,
            channelLabel: channel.label,
            organizationId: channel.organizationId,
            eventId: sale.eventId,
            externalOrderNumber: sale.externalOrderNumber,
            reason,
        };

        try {
            const wsCodes = await this.organizationAudienceService.resolveMemberWsCodes(channel.organizationId);
            if (!wsCodes.length) {
                return;
            }
            await this.wsPublisher.sendToUsers(wsCodes, Events.EXTERNAL_SALE_QUARANTINED, payload);
            Log.info(
                `[ExternalSaleIngestion Service]: published 'external-sale/quarantined' for external sale (id ${sale.id}) `
                + `to ${wsCodes.length} member(s) of organization (id ${channel.organizationId})`,
            );
        } catch (err) {
            Log.error(`[ExternalSaleIngestion Service]: publish failed for external sale (id ${sale.id}): ${(err as Error).message}`);
        }
    }
}
