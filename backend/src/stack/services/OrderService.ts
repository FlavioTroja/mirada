import { Service } from "fastify-decorators";
import {
    Event,
    EventStatus,
    Order,
    OrderLine,
    OrderStatus,
    Organization,
    PayoutStatus,
    Prisma,
    Purchase,
    Registration,
    RegistrationChannel,
    RegistrationStatus,
} from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { domainError, isDomainError } from "@utils/helpers/domainError";
import { readI18nText } from "@utils/helpers/i18nText";
import { OrderAttendeeRecord, readOrderAttendees, registrationIdsOfLines } from "@utils/helpers/orderAttendees";
import { DomainErrorCode } from "@enums/DomainErrorCode";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrderAttendeeDTO, OrderReserveDTO } from "@DTOs/order/OrderReserveDTO";
import { OrderConfirmPartialDTO } from "@DTOs/order/OrderActionsDTO";
import { OrderOverlapDTO, OrderReceiptResponseDTO, OrderReserveResponseDTO } from "@DTOs/order/OrderResponseDTO";
import { OrderQueryDTO } from "@DTOs/order/OrderQueryDTO";
import { OrderRepository, OrderWithContext } from "@repositories/OrderRepository";
import { OrderLineRepository } from "@repositories/OrderLineRepository";
import { PurchaseRepository } from "@repositories/PurchaseRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { EventRepository } from "@repositories/EventRepository";
import { OrganizationRepository } from "@repositories/OrganizationRepository";
import { TicketTypeRepository, TicketTypeWithSessions } from "@repositories/TicketTypeRepository";
import { EventServiceRepository } from "@repositories/EventServiceRepository";
import { UserRepository } from "@repositories/UserRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { OrderPricingService, PricedLine } from "@services/OrderPricingService";
import { OrderReservationService } from "@services/OrderReservationService";
import { OrderDocumentService } from "@services/OrderDocumentService";
import { CapacityEngineService, CommitItem } from "@services/CapacityEngineService";
import { RegistrationNotifierService } from "@services/RegistrationNotifierService";

/** Un partecipante risolto dal carrello — **una persona, una iscrizione** (§4.10). */
type PlannedAttendee = {
    /** Email normalizzata: è l'identità della persona dentro un ordine. */
    key: string;
    attendee: OrderAttendeeDTO;
    ticketTypeIds: number[];
    serviceIds: number[];
    /** Quante volte la persona compare sulle righe di titolo — normalmente 1. */
    quantity: number;
    registrationId?: number;
};

/** Una riga del carrello dopo la risoluzione, prima della scrittura. */
type PlannedLine = {
    organizationId: number;
    ticketTypeId: number | null;
    eventServiceId: number | null;
    quantity: number;
    attendees: PlannedAttendee[];
};

/**
 * # L'ordine — backend-brief §4.11, §3.7
 *
 * **Solo orchestrazione.** Il denaro sta in `OrderPricingService`, la
 * prenotazione in `OrderReservationService`, la capienza in
 * `CapacityEngineService`, l'emissione in `OrderFulfilmentService`. Qui c'è la
 * sequenza, e la sequenza è la cosa che si sbaglia: non c'è una
 * moltiplicazione in questo file, e non deve entrarci.
 *
 * ── `reserve`, in **una sola** `$transaction` (§4.11) ────────────────────────
 * 1. la vendita è aperta (`SALES_CLOSED`) e l'organizzazione incassa
 *    (`PAYOUT_NOT_ENABLED`);
 * 2. il carrello si **suddivide in un ordine per organizzatore** (`RF-PAY-34`) e
 *    i diritti di prevendita si calcolano **per biglietto** (`RF-PAY-35`), così
 *    la suddivisione non cambia il totale complessivo;
 * 3. il prezzo si risolve e si **blocca** (`priceLockedAt`): chi entra in
 *    checkout con lo scaglione disponibile non se lo vede cambiare durante i
 *    quindici minuti, **anche se nel frattempo lo scaglione si esaurisce**
 *    (`RF-EVT-27`). Il prezzo bloccato vive sulla riga d'ordine, con il
 *    `priceTierId` da cui viene: è ciò che rende il blocco verificabile e non
 *    solo dichiarato;
 * 4. le `Registration` nascono in stato `TO_CONFIRM` e il motore **impegna**;
 * 5. la `Reservation` dei quindici minuti chiude la transazione.
 *
 * ── Disponibilità parziale (`RF-PAY-15`, `RB17`) ────────────────────────────
 * *Un'iscrizione da novanta euro non fallisce per un accessorio da venticinque.*
 * Se risultano esaurite **soltanto** quote di ambito `SERVICE`, l'ordine **non si
 * rifiuta**: si impegna tutto il resto, l'ordine resta scritto e prenotato, e si
 * risponde `PARTIAL_AVAILABILITY` nominando le righe indisponibili. La conferma
 * esplicita arriva da `confirm-partial`, che le rimuove e **ricalcola il totale**.
 *
 * Perché l'ordine esista già a quel punto è una necessità, non una scelta:
 * `POST /orders/:id/confirm-partial` porta un `:id` nel percorso, e un id che
 * nessuna risposta ha mai emesso non è raggiungibile. La transazione perciò
 * **committa**, e il codice di dominio viaggia con gli identificativi nel payload
 * del §3.3.
 *
 * ── Sovrapposizione fra titoli (`RF-PAY-26`) ────────────────────────────────
 * Si **segnala senza bloccare**, e la quota della sessione condivisa **non è
 * consumata due volte**. Nessuna riga di questo file se ne occupa: la persona ha
 * una `Registration` sola e quindi un solo `CommitItem`, che porta tutti i suoi
 * titoli in `ticketTypeIds` — la deduplica per id del motore fa il resto. Qui si
 * calcola soltanto l'**avviso**, perché «segnalare» richiede un destinatario.
 */
@Service()
export class OrderService {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly orderLineRepository: OrderLineRepository,
        private readonly purchaseRepository: PurchaseRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly eventRepository: EventRepository,
        private readonly organizationRepository: OrganizationRepository,
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly eventServiceRepository: EventServiceRepository,
        private readonly userRepository: UserRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly orderPricingService: OrderPricingService,
        private readonly orderReservationService: OrderReservationService,
        private readonly orderDocumentService: OrderDocumentService,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly registrationNotifierService: RegistrationNotifierService,
    ) {}

    // ═════════════════════════════════════════════════════════════════════════
    // `POST /orders/reserve` (§3.7)
    // ═════════════════════════════════════════════════════════════════════════

    public async reserve(principalId: number, dto: OrderReserveDTO): Promise<OrderReserveResponseDTO> {
        const event = await this.loadSellableEvent(dto.eventId);
        const organization = await this.assertPayoutEnabled(event);

        const plan = await this.planCart(event, organization, dto);

        Log.info(
            `[Order Service]: reserve requested by user (id ${principalId}) on event (id ${event.id}) — `
            + `${plan.lines.length} line(s), ${plan.participants.length} participant(s)`,
        );

        const outcome = await getPrismaClient().$transaction(async prisma => {
            // `RF-PAY-23` PRIMA di ogni scrittura: una seconda prenotazione sullo
            // stesso evento è rifiutata, non creata e poi annullata.
            await this.orderReservationService.assertNoActiveReservation(principalId, event.id, prisma);

            // ── Le iscrizioni, una per persona ───────────────────────────────
            for (const participant of plan.participants) {
                const registration = await this.registrationRepository.save(
                    {
                        eventId: event.id,
                        holderName: participant.attendee.name,
                        holderSurname: participant.attendee.surname,
                        holderEmail: participant.attendee.email,
                        declaredRole: participant.attendee.declaredRole,
                        channel: RegistrationChannel.ONLINE_SALE,
                        // Stato coerente: l'iscrizione esiste ed è impegnata, ma
                        // non è confermata finché l'ordine non è saldato. La
                        // conferma è di `OrderFulfilmentService`.
                        status: RegistrationStatus.TO_CONFIRM,
                    },
                    prisma,
                );
                participant.registrationId = registration.id;
            }

            // ── Il denaro, una tariffa sola per tutto il carrello ────────────
            const policy = await this.orderPricingService.policy(prisma);
            const priced = new Map<PlannedLine, PricedLine>();
            for (const line of plan.lines) {
                priced.set(
                    line,
                    await this.orderPricingService.priceLine(
                        {
                            ticketTypeId: line.ticketTypeId,
                            eventServiceId: line.eventServiceId,
                            quantity: line.quantity,
                        },
                        policy,
                        prisma,
                    ),
                );
            }

            // ── `RF-PAY-34` — un ordine per organizzatore ────────────────────
            const purchase = await this.purchaseRepository.save({ buyerUserId: principalId }, prisma);

            const now = new Date();
            const expiresAt = await this.orderReservationService.expiryFrom(now, prisma);
            const byOrganization = new Map<number, PlannedLine[]>();
            for (const line of plan.lines) {
                byOrganization.set(line.organizationId, [...(byOrganization.get(line.organizationId) ?? []), line]);
            }

            const orders: Order[] = [];
            const writtenLines: OrderLine[] = [];

            for (const [organizationId, lines] of byOrganization) {
                const totals = this.orderPricingService.totals(lines.map(line => priced.get(line)!));

                const order = await this.orderRepository.save(
                    {
                        purchaseId: purchase.id,
                        organizationId,
                        eventId: event.id,
                        status: OrderStatus.PENDING_PAYMENT,
                        subtotal: totals.subtotal,
                        presaleRights: totals.presaleRights,
                        total: totals.total,
                        // `RF-EVT-27` — il prezzo è bloccato adesso e non si muove
                        // per tutta la durata della prenotazione.
                        priceLockedAt: now,
                        expiresAt,
                    },
                    prisma,
                );
                orders.push(order);

                for (const line of lines) {
                    const money = priced.get(line)!;
                    const written = await this.orderLineRepository.save(
                        {
                            orderId: order.id,
                            ticketTypeId: line.ticketTypeId,
                            eventServiceId: line.eventServiceId,
                            quantity: line.quantity,
                            unitPrice: money.unitPrice,
                            presaleRightsPerUnit: money.presaleRightsPerUnit,
                            lineTotal: money.lineTotal,
                            priceTierId: money.priceTierId,
                            attendees: this.attendeesJson(line),
                        },
                        prisma,
                    );
                    writtenLines.push(written);
                }
            }

            const purchaseTotals = this.orderPricingService.totals(plan.lines.map(line => priced.get(line)!));
            const updatedPurchase = await this.purchaseRepository.update(
                { id: purchase.id },
                { totalAmount: purchaseTotals.total, totalPresaleRights: purchaseTotals.presaleRights },
                undefined,
                undefined,
                prisma,
            );

            // ── L'impegno di capienza ────────────────────────────────────────
            const partial = await this.commitCart(event.id, plan, prisma);

            // ── La prenotazione dei quindici minuti (`RF-PAY-25`) ────────────
            for (const order of orders) {
                await this.orderReservationService.create(
                    { orderId: order.id, eventId: event.id, userId: principalId, expiresAt },
                    prisma,
                );
            }

            return {
                purchase: updatedPurchase,
                orders,
                lines: writtenLines,
                expiresAt,
                partial,
            };
        });

        const registrationIds = plan.participants
            .map(participant => participant.registrationId)
            .filter((id): id is number => !!id);

        // La transazione è chiusa: da qui in poi ciò che è scritto resta scritto.

        // §3.9 — **dopo il commit e prima di ogni uscita**, compresa quella per
        // `PARTIAL_AVAILABILITY`: le iscrizioni sono scritte e impegnate anche in
        // quel ramo (`RB17` — non si rifiuta un'iscrizione per un accessorio), e
        // il cruscotto dell'organizzatore deve vederle comparire in ogni caso.
        await this.registrationNotifierService.registrationsCreated(event, registrationIds);

        if (outcome.partial) {
            const unavailableLineIds = outcome.lines
                .filter(line => line.eventServiceId && outcome.partial!.serviceIds.includes(line.eventServiceId))
                .map(line => line.id);

            Log.warn(
                `[Order Service]: order (id ${outcome.orders.map(o => o.id).join(", ")}) reserved with PARTIAL_AVAILABILITY `
                + `on event (id ${event.id}) — ${unavailableLineIds.length} service line(s) could not be committed `
                + "(RB17: the registration is NOT refused for an accessory)",
            );

            throw domainError(
                DomainErrorCode.PARTIAL_AVAILABILITY,
                "Uno o più servizi accessori sono appena andati esauriti. L'iscrizione è impegnata: "
                + "conferma per completarla senza di essi.",
                409,
                {
                    purchaseId: outcome.purchase.id,
                    orderIds: outcome.orders.map(order => order.id),
                    expiresAt: outcome.expiresAt,
                    registrationIds,
                    removeLineIds: unavailableLineIds,
                    unavailable: outcome.partial.unavailable,
                },
            );
        }

        Log.info(
            `[Order Service]: purchase (id ${outcome.purchase.id}) reserved on event (id ${event.id}) — `
            + `${outcome.orders.length} order(s), ${registrationIds.length} registration(s), `
            + `expires at ${outcome.expiresAt.toISOString()}`,
        );

        return {
            purchase: outcome.purchase,
            orders: outcome.orders,
            expiresAt: outcome.expiresAt,
            registrationIds,
            overlaps: plan.overlaps,
        };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // `POST /orders/:id/confirm-partial` (§3.7, `RF-PAY-15`, `RB17`)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * **La conferma esplicita.** L'utente sta accettando di comprare *meno* di
     * quanto aveva messo nel carrello, e nessun sistema può decidere al posto suo
     * che la cena non gli interessava.
     *
     * In una transazione: si cancellano le righe accettate, si **riconcilia la
     * capienza** — rilascio dei consumi dell'ordine e nuovo impegno sull'insieme
     * ridotto, come fa la riassegnazione di ruolo (`05` §8) — e si **ricalcola il
     * totale** su ciò che resta, ordine e acquisto insieme. Se qualcosa fallisce,
     * fallisce tutto: non esiste un ordine mezzo confermato.
     *
     * Il nuovo impegno è un **sottoinsieme** di quello appena rilasciato: non può
     * essere rifiutato per capienza, e se lo fosse la transazione tornerebbe
     * indietro senza aver perso nulla.
     */
    public async confirmPartial(
        principalId: number,
        orderId: number,
        dto: OrderConfirmPartialDTO,
    ): Promise<Order> {
        const order = await this.findOrderForActorOrThrow(principalId, orderId);

        if (order.status !== OrderStatus.PENDING_PAYMENT) {
            Log.warn(`[Order Service]: confirm-partial refused — order (id ${orderId}) is ${order.status}`);
            throw new httpErrors.BadRequest("Solo un ordine in attesa di pagamento può essere confermato parzialmente.");
        }

        const removable = new Set(order.lines.map(line => line.id));
        const unknown = dto.removeLineIds.filter(id => !removable.has(id));
        if (unknown.length) {
            Log.warn(`[Order Service]: confirm-partial refused — line(s) [${unknown.join(", ")}] do not belong to order (id ${orderId})`);
            throw new httpErrors.BadRequest("Una o più righe indicate non appartengono a questo ordine.");
        }
        if (dto.removeLineIds.length === order.lines.length) {
            Log.warn(`[Order Service]: confirm-partial refused — removing every line of order (id ${orderId}) is an abandon`);
            throw new httpErrors.BadRequest(
                "Rimuovere tutte le righe equivale ad abbandonare l'ordine: usa `POST /orders/:id/abandon`.",
            );
        }

        Log.info(
            `[Order Service]: confirm-partial on order (id ${orderId}) — removing ${dto.removeLineIds.length} `
            + `of ${order.lines.length} line(s)`,
        );

        const updated = await getPrismaClient().$transaction(async prisma => {
            await this.orderLineRepository.deleteByIds(dto.removeLineIds, prisma);
            const remaining = await this.orderLineRepository.findByOrder(orderId, prisma);

            // Riconciliazione della capienza: rilascio e nuovo impegno nella
            // STESSA transazione (`05` §8).
            const registrationIds = registrationIdsOfLines(order.lines);
            if (registrationIds.length) {
                await this.capacityEngineService.releaseRegistrations(registrationIds, prisma);
            }
            const items = this.commitItemsFromLines(remaining);
            if (items.length) {
                await this.capacityEngineService.commit(order.eventId, items, prisma);
            }

            // Il totale si ricalcola su ciò che resta, mai si sottrae: sottrarre
            // presume che la riga rimossa fosse valutata con la stessa tariffa,
            // e la tariffa è un parametro che può essere cambiato nel frattempo.
            const totals = this.orderPricingService.totals(remaining);
            const written = await this.orderRepository.update(
                { id: orderId },
                { subtotal: totals.subtotal, presaleRights: totals.presaleRights, total: totals.total },
                undefined,
                undefined,
                prisma,
            );

            const siblings = await this.orderRepository.findByPurchase(order.purchaseId, prisma);
            const purchaseTotal = siblings.reduce(
                (sum, sibling) => sum + (sibling.id === orderId ? totals.total : sibling.total),
                0,
            );
            const purchasePresale = siblings.reduce(
                (sum, sibling) => sum + (sibling.id === orderId ? totals.presaleRights : sibling.presaleRights),
                0,
            );
            await this.purchaseRepository.update(
                { id: order.purchaseId },
                { totalAmount: purchaseTotal, totalPresaleRights: purchasePresale },
                undefined,
                undefined,
                prisma,
            );

            Log.info(
                `[Order Service]: order (id ${orderId}) confirmed partially — ${remaining.length} line(s) left, `
                + `total recomputed to ${totals.total} cents (subtotal ${totals.subtotal} + presale ${totals.presaleRights})`,
            );
            return written;
        });

        return updated;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // `GET /orders/:id/receipt` (§3.7, `RF-PAY-12`)
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * **Non è un titolo fiscale**, come il PDF del biglietto: nessuna numerazione
     * progressiva, nessuna dicitura che possa farlo apparire tale. È una delle
     * tre condizioni che reggono il posizionamento fiscale della piattaforma.
     */
    public async receipt(principalId: number, orderId: number): Promise<OrderReceiptResponseDTO> {
        const order = await this.findOrderForActorOrThrow(principalId, orderId);
        const buyer = await this.userRepository.findOne(
            { id: order.purchase.buyerUserId },
            { populate: "person.contact" },
        );

        const labels = await this.lineLabels(order.lines);
        const document = await this.orderDocumentService.build({
            order,
            lines: order.lines,
            event: order.event,
            organizationName: order.organization.name,
            buyerLabel: this.buyerLabel(buyer),
            labelForLine: line => labels.get(line.id) ?? `Riga #${line.id}`,
        });

        Log.info(`[Order Service]: receipt served for order (id ${orderId}) at ${document.url}`);
        return { fileUrl: document.url };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Lettura del dialetto (§3.2) — `Order` non si crea né si modifica da fuori
    // ═════════════════════════════════════════════════════════════════════════

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Order | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.orderRepository.findOneVisible(scope, principalId, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: OrderQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<Order>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.orderRepository.paginateVisible(scope, principalId, this.createQueryFromPayload(query), options);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Interni
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * `SALES_CLOSED` — la vendita online è aperta solo su un evento `PUBLISHED`,
     * prima della data di chiusura configurata e prima dell'inizio.
     *
     * `EVENT_START` resta sempre attivo come ultimo criterio (`RF-EVT-40`): non
     * è configurabile, e un evento iniziato non vende più online qualunque cosa
     * dica `salesCloseCriteria`.
     */
    private async loadSellableEvent(eventId: number): Promise<Event> {
        const event = await this.eventRepository.findOne({ id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[Order Service]: reserve refused — event (id ${eventId}) not found`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }

        const now = Date.now();
        const closed =
            event.status !== EventStatus.PUBLISHED
            || (!!event.salesCloseAt && event.salesCloseAt.getTime() <= now)
            || event.startAt.getTime() <= now;

        if (closed) {
            Log.warn(
                `[Order Service]: reserve refused on event (id ${eventId}) — SALES_CLOSED `
                + `(status ${event.status}, salesCloseAt ${event.salesCloseAt?.toISOString() ?? "none"}, `
                + `startAt ${event.startAt.toISOString()})`,
            );
            throw domainError(
                DomainErrorCode.SALES_CLOSED,
                "Le vendite online di questo evento sono chiuse.",
                409,
                { eventId, status: event.status },
            );
        }

        return event;
    }

    /**
     * `PAYOUT_NOT_ENABLED` — non si vende per conto di chi non può incassare.
     * Il presidio è lo stesso della pubblicazione (`RB13`) e vale di nuovo qui,
     * perché lo stato dell'account presso il prestatore può decadere **dopo** la
     * pubblicazione: un evento pubblicato non è la prova che oggi si incassi.
     */
    private async assertPayoutEnabled(event: Event): Promise<Organization> {
        const organization = await this.organizationRepository.findOne({ id: event.organizationId, deleted: false });
        if (!organization) {
            Log.error(`[Order Service]: reserve failed — organization (id ${event.organizationId}) of event (id ${event.id}) not found`);
            throw new httpErrors.NotFound("Organizzazione non trovata.");
        }

        if (organization.payoutStatus !== PayoutStatus.ENABLED) {
            Log.warn(
                `[Order Service]: reserve refused on event (id ${event.id}) — organization (id ${organization.id}) `
                + `payoutStatus is ${organization.payoutStatus}, not ENABLED`,
            );
            throw domainError(
                DomainErrorCode.PAYOUT_NOT_ENABLED,
                "L'organizzatore non è al momento abilitato all'incasso: la vendita non può essere completata.",
                409,
                { organizationId: organization.id, payoutStatus: organization.payoutStatus },
            );
        }

        return organization;
    }

    /**
     * Traduce il corpo del §3.7 in righe e partecipanti, **senza scrivere nulla**.
     *
     * L'assegnazione dei partecipanti segue ciò che dichiara il DTO: la riga usa i
     * propri `attendees` se li porta, altrimenti attinge in ordine all'elenco di
     * corpo — la forma comoda del caso normale, «due Full Pass, ecco i due nomi».
     * Una riga di **servizio** senza partecipanti propri si attacca alle persone
     * già risolte: un accessorio è di qualcuno, e senza nessuno a cui riferirlo
     * non è ordinabile.
     */
    private async planCart(
        event: Event,
        organization: Organization,
        dto: OrderReserveDTO,
    ): Promise<{ lines: PlannedLine[]; participants: PlannedAttendee[]; overlaps: OrderOverlapDTO[] }> {
        const participants = new Map<string, PlannedAttendee>();
        const pool = [...(dto.attendees ?? [])];
        const lines: PlannedLine[] = [];

        const upsertParticipant = (attendee: OrderAttendeeDTO): PlannedAttendee => {
            const key = attendee.email.trim().toLowerCase();
            const existing = participants.get(key);
            if (existing) {
                return existing;
            }
            const created: PlannedAttendee = { key, attendee, ticketTypeIds: [], serviceIds: [], quantity: 0 };
            participants.set(key, created);
            return created;
        };

        // ── Righe di titolo ──────────────────────────────────────────────────
        const ticketTypes = new Map<number, TicketTypeWithSessions>();
        for (const line of dto.lines.filter(candidate => !!candidate.ticketTypeId)) {
            const ticketType = await this.loadSellableTicketType(event, line.ticketTypeId!, line.quantity);
            ticketTypes.set(ticketType.id, ticketType);

            const drawn = line.attendees ?? pool.splice(0, line.quantity);
            if (drawn.length !== line.quantity) {
                Log.warn(
                    `[Order Service]: reserve refused — ticket type (id ${ticketType.id}) asks for ${line.quantity} `
                    + `attendee(s) and ${drawn.length} were available`,
                );
                throw new httpErrors.BadRequest(
                    "Serve un partecipante per ogni biglietto: nome, cognome, email e ruolo dichiarato.",
                );
            }

            const attendees = drawn.map(attendee => {
                const participant = upsertParticipant(attendee);
                participant.ticketTypeIds = [...new Set([...participant.ticketTypeIds, ticketType.id])];
                participant.quantity += 1;
                return participant;
            });

            lines.push({
                organizationId: event.organizationId,
                ticketTypeId: ticketType.id,
                eventServiceId: null,
                quantity: line.quantity,
                attendees,
            });
        }

        if (!participants.size) {
            Log.warn(`[Order Service]: reserve refused on event (id ${event.id}) — the cart has no ticket line`);
            throw new httpErrors.BadRequest(
                "Un ordine contiene almeno un titolo d'ingresso: un servizio accessorio non si acquista da solo.",
            );
        }

        // ── Righe di servizio ────────────────────────────────────────────────
        const resolved = [...participants.values()];
        for (const line of dto.lines.filter(candidate => !!candidate.eventServiceId)) {
            const service = await this.eventServiceRepository.findOne(
                { id: line.eventServiceId!, deleted: false },
            );
            if (!service || service.eventId !== event.id) {
                Log.warn(`[Order Service]: reserve refused — event service (id ${line.eventServiceId}) is not of event (id ${event.id})`);
                throw new httpErrors.BadRequest("Il servizio accessorio non appartiene a questo evento.");
            }

            const attendees = line.attendees
                ? line.attendees.map(attendee => upsertParticipant(attendee))
                : Array.from({ length: line.quantity }, (_, index) => resolved[index % resolved.length]!);

            for (const participant of attendees) {
                participant.serviceIds = [...new Set([...participant.serviceIds, service.id])];
            }

            lines.push({
                organizationId: event.organizationId,
                ticketTypeId: null,
                eventServiceId: service.id,
                quantity: line.quantity,
                attendees,
            });
        }

        const all = [...participants.values()];
        for (const participant of all) {
            participant.quantity = Math.max(1, participant.quantity);
        }

        Log.debug(
            `[Order Service]: cart planned on event (id ${event.id}) for organization (id ${organization.id}) — `
            + `${lines.length} line(s), ${all.length} participant(s)`,
        );

        return { lines, participants: all, overlaps: this.detectOverlaps(all, ticketTypes) };
    }

    /** Il titolo è di questo evento, è in vendita e la quantità sta nei limiti dichiarati (§4.7). */
    private async loadSellableTicketType(
        event: Event,
        ticketTypeId: number,
        quantity: number,
    ): Promise<TicketTypeWithSessions> {
        const ticketType = await this.ticketTypeRepository.findWithSessions(ticketTypeId);
        if (!ticketType || ticketType.eventId !== event.id || ticketType.deleted) {
            Log.warn(`[Order Service]: reserve refused — ticket type (id ${ticketTypeId}) is not of event (id ${event.id})`);
            throw new httpErrors.BadRequest("Il titolo d'ingresso non appartiene a questo evento.");
        }

        const now = Date.now();
        if (
            (ticketType.saleOpensAt && ticketType.saleOpensAt.getTime() > now)
            || (ticketType.saleClosesAt && ticketType.saleClosesAt.getTime() <= now)
        ) {
            Log.warn(`[Order Service]: reserve refused — ticket type (id ${ticketTypeId}) is outside its own sale window`);
            throw domainError(
                DomainErrorCode.SALES_CLOSED,
                "Questo titolo d'ingresso non è in vendita in questo momento.",
                409,
                { ticketTypeId },
            );
        }

        if (quantity < ticketType.minPerOrder || quantity > ticketType.maxPerOrder) {
            Log.warn(
                `[Order Service]: reserve refused — ${quantity} unit(s) of ticket type (id ${ticketTypeId}) `
                + `outside [${ticketType.minPerOrder}, ${ticketType.maxPerOrder}]`,
            );
            throw new httpErrors.BadRequest(
                `Per questo titolo si acquistano da ${ticketType.minPerOrder} a ${ticketType.maxPerOrder} biglietti per ordine.`,
            );
        }

        return ticketType;
    }

    /**
     * `RF-PAY-26` — **si segnala senza bloccare**. L'avviso nomina la sessione e
     * i titoli che se la contendono: chi compra un Full Pass e un Workshop sulla
     * stessa serata deve sapere che quella serata è già inclusa, e decidere lui.
     * L'effetto vero — la quota non consumata due volte — è del motore.
     */
    private detectOverlaps(
        participants: PlannedAttendee[],
        ticketTypes: Map<number, TicketTypeWithSessions>,
    ): OrderOverlapDTO[] {
        const overlaps: OrderOverlapDTO[] = [];

        for (const participant of participants) {
            if (participant.ticketTypeIds.length < 2) {
                continue;
            }
            const bySession = new Map<number, number[]>();
            for (const ticketTypeId of participant.ticketTypeIds) {
                for (const link of ticketTypes.get(ticketTypeId)?.sessions ?? []) {
                    bySession.set(link.sessionId, [...(bySession.get(link.sessionId) ?? []), ticketTypeId]);
                }
            }
            for (const [sessionId, owners] of bySession) {
                if (owners.length > 1) {
                    overlaps.push({
                        registrationId: participant.registrationId ?? -1,
                        holderEmail: participant.attendee.email,
                        sessionId,
                        ticketTypeIds: owners,
                    });
                }
            }
        }

        return overlaps;
    }

    /**
     * L'impegno, con il ramo di **disponibilità parziale**.
     *
     * `CapacityEngineService.commit` classifica il rifiuto *prima* di toccare un
     * contatore: quando arriva `PARTIAL_AVAILABILITY` non c'è stata alcuna
     * scrittura, la transazione PostgreSQL è integra, e si può ritentare
     * **senza i servizi esauriti** dentro la stessa transazione. È ciò che rende
     * `RB17` realizzabile senza un secondo giro di rete e senza lasciare
     * l'ordine in uno stato che nessuno ha chiesto.
     */
    private async commitCart(
        eventId: number,
        plan: { participants: PlannedAttendee[] },
        tx: Prisma.TransactionClient,
    ): Promise<{ serviceIds: number[]; unavailable: unknown[] } | null> {
        const items = (): CommitItem[] => plan.participants.map(participant => ({
            registrationId: participant.registrationId!,
            ticketTypeId: participant.ticketTypeIds[0] ?? null,
            // Gli **altri** titoli della stessa persona: è il campo con cui il
            // motore evita di consumare due volte la quota di una sessione
            // condivisa (`RF-PAY-26`). Non c'è nulla da reinventare qui.
            ticketTypeIds: participant.ticketTypeIds.slice(1),
            serviceIds: participant.serviceIds,
            quantity: participant.quantity,
        }));

        try {
            await this.capacityEngineService.commit(eventId, items(), tx);
            return null;
        } catch (err) {
            if (!isDomainError(err) || err.domainCode !== DomainErrorCode.PARTIAL_AVAILABILITY) {
                throw err;
            }

            const unavailable = (err.payload?.unavailable ?? []) as { scopeId: number | null }[];
            const serviceIds = unavailable
                .map(entry => entry.scopeId)
                .filter((id): id is number => !!id);

            Log.warn(
                `[Order Service]: PARTIAL_AVAILABILITY on event (id ${eventId}) — retrying the commit without `
                + `service(s) [${serviceIds.join(", ")}] (RB17)`,
            );

            for (const participant of plan.participants) {
                participant.serviceIds = participant.serviceIds.filter(id => !serviceIds.includes(id));
            }
            await this.capacityEngineService.commit(eventId, items(), tx);

            return { serviceIds, unavailable };
        }
    }

    /** Ricostruisce gli impegni dalle righe scritte — la strada di `confirm-partial`. */
    private commitItemsFromLines(lines: OrderLine[]): CommitItem[] {
        const byRegistration = new Map<
            number,
            { registrationId: number; ticketTypeIds: number[]; serviceIds: number[]; quantity: number }
        >();

        for (const line of lines) {
            for (const attendee of readOrderAttendees(line)) {
                if (!attendee.registrationId) {
                    continue;
                }
                const item = byRegistration.get(attendee.registrationId) ?? {
                    registrationId: attendee.registrationId,
                    ticketTypeIds: [] as number[],
                    serviceIds: [] as number[],
                    quantity: 0,
                };
                if (line.ticketTypeId) {
                    item.ticketTypeIds = [...new Set([...item.ticketTypeIds, line.ticketTypeId])];
                    item.quantity += 1;
                }
                if (line.eventServiceId) {
                    item.serviceIds = [...new Set([...item.serviceIds, line.eventServiceId])];
                }
                byRegistration.set(attendee.registrationId, item);
            }
        }

        return [...byRegistration.values()].map(item => ({
            registrationId: item.registrationId,
            ticketTypeId: item.ticketTypeIds[0] ?? null,
            ticketTypeIds: item.ticketTypeIds.slice(1),
            serviceIds: item.serviceIds,
            quantity: Math.max(1, item.quantity),
        }));
    }

    /**
     * I partecipanti come finiscono su `OrderLine.attendees`, **con
     * l'identificativo dell'iscrizione**: è il solo legame fra la riga e la
     * capienza che impegna (vedi `@utils/helpers/orderAttendees`).
     */
    private attendeesJson(line: PlannedLine): Prisma.InputJsonValue {
        return line.attendees.map(participant => ({
            ...participant.attendee,
            registrationId: participant.registrationId ?? null,
        } satisfies OrderAttendeeRecord) as unknown as Prisma.InputJsonValue);
    }

    private async lineLabels(lines: OrderLine[]): Promise<Map<number, string>> {
        const labels = new Map<number, string>();
        for (const line of lines) {
            if (line.ticketTypeId) {
                const ticketType = await this.ticketTypeRepository.findOne({ id: line.ticketTypeId });
                labels.set(line.id, readI18nText(ticketType?.name, `Titolo #${line.ticketTypeId}`)!);
            } else if (line.eventServiceId) {
                const service = await this.eventServiceRepository.findOne({ id: line.eventServiceId });
                labels.set(line.id, readI18nText(service?.name, `Servizio #${line.eventServiceId}`)!);
            }
        }
        return labels;
    }

    private buyerLabel(buyer: unknown): string {
        const person = (buyer as { person?: { name?: string; surname?: string; contact?: { email?: string } } })?.person;
        const name = [person?.name, person?.surname].filter(Boolean).join(" ");
        return name || person?.contact?.email || "Acquirente";
    }

    /**
     * Chi può vedere e agire su un ordine: **l'acquirente** o lo **staff
     * dell'organizzazione che incassa** (§1.5). Un ordine di un terzo non
     * esiste, e si risponde `404` — non `403`, che confermerebbe l'esistenza.
     */
    private async findOrderForActorOrThrow(principalId: number, orderId: number): Promise<OrderWithContext> {
        const order = await this.orderRepository.findWithContext(orderId);
        if (!order) {
            Log.warn(`[Order Service]: order (id ${orderId}) not found`);
            throw new httpErrors.NotFound("Ordine non trovato.");
        }
        if (order.purchase.buyerUserId === principalId) {
            return order;
        }

        const scope = await this.organizationScopeService.resolve(principalId);
        if (scope === null || scope.includes(order.organizationId)) {
            return order;
        }

        Log.warn(
            `[Order Service]: user (id ${principalId}) is neither the buyer of order (id ${orderId}) nor a member `
            + `of organization (id ${order.organizationId})`,
        );
        throw new httpErrors.NotFound("Ordine non trovato.");
    }

    private createQueryFromPayload(payload: OrderQueryDTO): Prisma.OrderWhereInput {
        const query: Prisma.OrderWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.status, { status: payload.status }),
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.organizationId, { organizationId: payload.organizationId }),
            createObjectWithoutThrow(payload.purchaseId, { purchaseId: payload.purchaseId }),
            // «L'unico testo di un ordine è il nome dei partecipanti sulle righe»
            // (`OrderQueryDTO`), e i partecipanti stanno in un `Json`: il filtro è
            // perciò `string_contains` sulla colonna, non una `contains` su una
            // colonna di testo che non esiste.
            createObjectWithoutThrow(payload.value, {
                lines: { some: { attendees: { string_contains: payload.value ?? "" } } },
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }

    /** Le iscrizioni impegnate da un ordine — usato da `OrderFulfilmentService`. */
    public async registrationsOfOrder(order: OrderWithContext, tx?: Prisma.TransactionClient): Promise<Registration[]> {
        const ids = registrationIdsOfLines(order.lines);
        return ids.length ? this.registrationRepository.findByIds(ids, tx) : [];
    }

    /** L'ordine con tutto il contesto, già filtrato per il chiamante. */
    public async findVisibleWithContext(principalId: number, orderId: number): Promise<OrderWithContext> {
        return this.findOrderForActorOrThrow(principalId, orderId);
    }

    /** L'acquisto che raggruppa gli ordini — serve alla ricevuta e alla conferma. */
    public async purchaseOf(order: OrderWithContext): Promise<Purchase> {
        return order.purchase;
    }
}
