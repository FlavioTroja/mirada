import { Service } from "fastify-decorators";
import {
    Order,
    OrderStatus,
    Payment,
    PaymentProvider,
    PaymentStatus,
    Prisma,
    RegistrationStatus,
    Ticket,
} from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { domainError } from "@utils/helpers/domainError";
import { readOrderAttendees } from "@utils/helpers/orderAttendees";
import { DomainErrorCode } from "@enums/DomainErrorCode";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrderConfirmFreeDTO } from "@DTOs/order/OrderActionsDTO";
import { PaymentQueryDTO } from "@DTOs/order/OrderQueryDTO";
import { OrderWithContext } from "@repositories/OrderRepository";
import { OrderRepository } from "@repositories/OrderRepository";
import { PaymentRepository } from "@repositories/PaymentRepository";
import { TicketRepository } from "@repositories/TicketRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { CapacityQuotaRepository } from "@repositories/CapacityQuotaRepository";
import { UserRepository } from "@repositories/UserRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { OrderService } from "@services/OrderService";
import { OrderReservationService } from "@services/OrderReservationService";
import { CapacityEngineService } from "@services/CapacityEngineService";
import { TicketService } from "@services/TicketService";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { PaymentSucceededPayloadDTO } from "@websocket/dtos/PaymentSucceededPayloadDTO";

/**
 * Ciò che un prestatore di pagamento dichiara quando l'incasso è avvenuto.
 *
 * È **la sola forma** che `fulfil` accetta, e non è un dettaglio: `confirm-free`
 * e l'adapter Stripe della fase D2 riempiono questo stesso oggetto, e da lì in
 * poi percorrono **esattamente lo stesso codice**. Se un giorno i due percorsi
 * divergono, divergeranno qui e non nel resto del servizio.
 */
export type SettlementFact = {
    provider: PaymentProvider;
    /** Riferimento del prestatore. Sul percorso senza prestatore è quello dell'ordine. */
    providerPaymentId: string;
    /** Account connesso su cui è avvenuto l'incasso. Vuoto senza prestatore. */
    providerAccountId: string;
    amount: number;
    /** Diritti di prevendita — `application_fee_amount` con Stripe (direct charges). */
    applicationFeeAmount: number;
    /**
     * **Unica in tabella**: è la difesa contro la doppia registrazione. Si
     * costruisce dall'ordine, non da un contatore, così due tentativi di chiudere
     * lo stesso ordine producono un conflitto di chiave invece di due pagamenti.
     */
    idempotencyKey: string;
};

export type FulfilmentOutcome = {
    order: Order;
    payment: Payment;
    tickets: Ticket[];
    confirmedRegistrationIds: number[];
};

/**
 * # La chiusura dell'ordine — backend-brief §4.11, §3.7
 *
 * Ciò che accade **quando l'ordine è saldato**: risoluzione dei ruoli flessibili,
 * conferma delle iscrizioni, emissione dei biglietti, chiusura della prenotazione
 * con `releaseReason = COMPLETED`, registrazione del `Payment`.
 *
 * ── `confirm-free` non è una scorciatoia ────────────────────────────────────
 * *«Ammesso **solo** se il totale è zero o se l'organizzatore ha dichiarato
 * l'incasso fuori piattaforma: non è una scorciatoia per saltare il pagamento.»*
 * Il presidio è realizzato in `assertFreeConfirmationAllowed` ed è **doppio**:
 *  - a totale zero non c'è denaro, e chiunque possa vedere l'ordine può chiuderlo;
 *  - sopra lo zero serve un **atto esplicito di chi incassa** — la dichiarazione
 *    `offPlatformPayment` **con il motivo**, e il chiamante deve essere membro
 *    dell'organizzazione che incassa. Un partecipante che potesse dichiarare di
 *    aver pagato fuori piattaforma trasformerebbe il presidio in una casella da
 *    spuntare, e il percorso degli ingressi gratuiti in un modo per non pagare.
 *
 * ── La prenotazione deve essere ancora viva ─────────────────────────────────
 * Si conferma solo ciò che è ancora impegnato. Una prenotazione scaduta significa
 * che i posti sono tornati disponibili e possono essere di qualcun altro:
 * confermare comunque emetterebbe biglietti su capienza non più impegnata, che è
 * il modo esatto in cui una persona paga e non entra.
 */
@Service()
export class OrderFulfilmentService {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly paymentRepository: PaymentRepository,
        private readonly ticketRepository: TicketRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly capacityQuotaRepository: CapacityQuotaRepository,
        private readonly userRepository: UserRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly orderService: OrderService,
        private readonly orderReservationService: OrderReservationService,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly ticketService: TicketService,
        private readonly wsPublisher: WsPublisherService,
    ) {}

    // ═════════════════════════════════════════════════════════════════════════
    // `POST /orders/:id/confirm-free` (§3.7)
    // ═════════════════════════════════════════════════════════════════════════

    public async confirmFree(
        principalId: number,
        orderId: number,
        dto: OrderConfirmFreeDTO,
    ): Promise<FulfilmentOutcome> {
        const order = await this.orderService.findVisibleWithContext(principalId, orderId);
        await this.assertFreeConfirmationAllowed(principalId, order, dto);

        Log.info(
            `[OrderFulfilment Service]: confirm-free requested by user (id ${principalId}) on order (id ${orderId}) — `
            + `total ${order.total} cents, ${dto.offPlatformPayment ? `off-platform: ${dto.offPlatformReason}` : "zero-amount"}`,
        );

        return this.fulfil(order, {
            provider: PaymentProvider.NONE,
            providerPaymentId: `order-${order.id}`,
            providerAccountId: "",
            amount: order.total,
            applicationFeeAmount: order.presaleRights,
            idempotencyKey: `order-${order.id}-none`,
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // La chiusura vera — condivisa con l'adapter della fase D2
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * Chiude l'ordine in **una** transazione, dato per acquisito che l'incasso è
     * avvenuto. Non conosce Stripe, non conosce `confirm-free`: conosce un
     * `SettlementFact`.
     *
     * L'ordine dei passi non è arbitrario. I ruoli si risolvono **prima** della
     * conferma perché `assignedRole` è un campo dell'iscrizione confermata; i
     * biglietti si emettono **dopo** la conferma perché un biglietto è la prova
     * di un'iscrizione che esiste; la prenotazione si chiude **per ultima** fra le
     * scritture di dominio, perché finché non è chiusa i posti sono ancora
     * *impegnati* e non ancora *venduti*.
     *
     * Il segnale WebSocket parte **dopo** il commit (§3.9).
     */
    public async fulfil(order: OrderWithContext, settlement: SettlementFact): Promise<FulfilmentOutcome> {
        if (order.status === OrderStatus.PAID) {
            // Idempotenza: la seconda notifica non emette un secondo biglietto.
            const existing = await this.paymentRepository.findByOrder(order.id);
            Log.info(`[OrderFulfilment Service]: order (id ${order.id}) is already PAID — fulfilment is a no-op (idempotent replay)`);
            return {
                order,
                payment: existing[0]!,
                tickets: await this.ticketRepository.findMany(
                    { orderLineId: { in: order.lines.map(line => line.id) }, deleted: false },
                    { orderBy: { id: "asc" } },
                ),
                confirmedRegistrationIds: [],
            };
        }

        if (order.status !== OrderStatus.PENDING_PAYMENT) {
            Log.warn(`[OrderFulfilment Service]: fulfilment refused — order (id ${order.id}) is ${order.status}`);
            throw new httpErrors.BadRequest("Solo un ordine in attesa di pagamento può essere chiuso.");
        }

        await this.assertReservationStillHeld(order);

        const outcome = await getPrismaClient().$transaction(async prisma => {
            // ── 1. I ruoli flessibili ────────────────────────────────────────
            // Il motore li ha già decisi impegnando la capienza. Qui si copre il
            // solo caso che resta aperto: un'iscrizione senza ruolo su un evento
            // che le quote di ruolo ce le ha (invariante I4 di `05` §12).
            const registrations = await this.orderService.registrationsOfOrder(order, prisma);
            const roleQuotas = await this.capacityQuotaRepository.findMany(
                { eventId: order.eventId, deleted: false, role: { not: null } },
                { orderBy: { id: "asc" } },
                prisma,
            );

            for (const registration of registrations) {
                if (registration.assignedRole || !roleQuotas.length) {
                    continue;
                }
                const role = await this.capacityEngineService.resolveFlexible(order.eventId, prisma);
                if (role) {
                    await this.registrationRepository.update(
                        { id: registration.id },
                        { assignedRole: role },
                        undefined,
                        undefined,
                        prisma,
                    );
                    Log.info(`[OrderFulfilment Service]: flexible registration (id ${registration.id}) resolved to ${role}`);
                }
            }

            // ── 2. Le iscrizioni confermate ──────────────────────────────────
            const confirmedRegistrationIds: number[] = [];
            for (const registration of registrations) {
                if (registration.status === RegistrationStatus.CONFIRMED) {
                    continue;
                }
                await this.registrationRepository.update(
                    { id: registration.id },
                    { status: RegistrationStatus.CONFIRMED, confirmedAt: new Date() },
                    undefined,
                    undefined,
                    prisma,
                );
                confirmedRegistrationIds.push(registration.id);
            }

            // ── 3. I biglietti ───────────────────────────────────────────────
            // Uno per partecipante e per riga di **titolo**: una riga di servizio
            // non produce un biglietto, perché una cena non è un titolo d'ingresso.
            const tickets: Ticket[] = [];
            for (const line of order.lines) {
                if (!line.ticketTypeId) {
                    continue;
                }
                for (const attendee of readOrderAttendees(line)) {
                    tickets.push(await this.ticketService.issue(
                        {
                            eventId: order.eventId,
                            ticketTypeId: line.ticketTypeId,
                            registrationId: attendee.registrationId ?? null,
                            orderLineId: line.id,
                            holderName: attendee.name,
                            holderSurname: attendee.surname,
                            holderEmail: attendee.email,
                            bearer: false,
                        },
                        prisma,
                    ));
                }
            }

            // ── 4. La prenotazione — COMPLETED, senza rilasciare nulla ───────
            await this.orderReservationService.complete(order.id, prisma);

            // ── 5. L'ordine e il pagamento ───────────────────────────────────
            const paid = await this.orderRepository.update(
                { id: order.id },
                { status: OrderStatus.PAID, paidAt: new Date(), expiresAt: null },
                undefined,
                undefined,
                prisma,
            );

            const payment = await this.paymentRepository.save(
                {
                    orderId: order.id,
                    provider: settlement.provider,
                    providerPaymentId: settlement.providerPaymentId,
                    providerAccountId: settlement.providerAccountId,
                    status: PaymentStatus.SUCCEEDED,
                    amount: settlement.amount,
                    applicationFeeAmount: settlement.applicationFeeAmount,
                    idempotencyKey: settlement.idempotencyKey,
                },
                prisma,
            );

            return { order: paid, payment, tickets, confirmedRegistrationIds };
        });

        Log.info(
            `[OrderFulfilment Service]: order (id ${order.id}) settled with provider ${settlement.provider} — `
            + `payment (id ${outcome.payment.id}) of ${settlement.amount} cents, ${outcome.tickets.length} ticket(s) issued, `
            + `${outcome.confirmedRegistrationIds.length} registration(s) confirmed`,
        );

        await this.publishPaymentSucceeded(order);
        return outcome;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ██  PUNTO D'INNESTO DI STRIPE — fase D2  ████████████████████████████████
    // ═════════════════════════════════════════════════════════════════════════
    //
    // `POST /orders/:id/checkout` e `POST /api/payments/stripe/webhook` **non
    // sono costruiti**: è una decisione del committente, dichiarata nel §7 del
    // brief, non una dimenticanza. Manca **solo l'adapter**, e questo blocco
    // esiste perché chi arriva dopo lo veda subito.
    //
    // ── Ciò che c'è già, e che l'adapter NON deve riscrivere ─────────────────
    //  · `fulfil(order, settlement)` — tutta la chiusura dell'ordine. Il webhook
    //    su `payment_intent.succeeded` la chiama e basta: ruoli flessibili,
    //    conferma delle iscrizioni, emissione dei biglietti, prenotazione
    //    `COMPLETED`, `Payment`, `payment/succeeded` all'acquirente. Il percorso
    //    di `confirm-free` è **esattamente questo**, meno l'adapter.
    //  · `Payment.idempotencyKey` unico — la difesa contro la doppia
    //    registrazione. Il webhook aggiunge `processedEventIds` (già in tabella)
    //    per l'idempotenza su `event.id` di Stripe (`RF-PAY-10`), che è la difesa
    //    contro la doppia notifica e il ritorno tardivo dell'utente.
    //  · `OrderReservationService.rearm` — da chiamare **all'avvio** del
    //    pagamento, prima del reindirizzamento (`RF-PAY-22`).
    //  · `order.presaleRights` — è già l'`application_fee_amount`, calcolato per
    //    biglietto (`RF-PAY-35`) e mai per ordine.
    //
    // ── Ciò che l'adapter deve aggiungere, e nient'altro ─────────────────────
    //  1. `checkout(orderId)` → crea il PaymentIntent **sull'account connesso**
    //     (`Organization.stripeAccountId`) con `application_fee_amount =
    //     order.presaleRights`: **direct charges**, i fondi non toccano mai il
    //     conto della piattaforma (§4.11). Restituisce
    //     `{ clientSecret, publishableKey, connectedAccountId }`.
    //  2. La rotta del webhook, **senza JWT**, autenticata dalla firma Stripe, e
    //     idempotente su `event.id`. Su `payment_intent.succeeded` costruisce il
    //     `SettlementFact` con `provider = STRIPE` e chiama `fulfil`. Su
    //     `payment_intent.payment_failed` chiude la prenotazione con
    //     `PAYMENT_FAILED` e l'ordine con `FAILED`.
    //
    // Nessuna riga di questo servizio va modificata per farlo.
    // ═════════════════════════════════════════════════════════════════════════

    // ═════════════════════════════════════════════════════════════════════════
    // `Payment` in sola lettura (§3.4)
    // ═════════════════════════════════════════════════════════════════════════

    public async findPaymentById(principalId: number, id: number, options?: FindOptions): Promise<Payment | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.paymentRepository.findOneVisible(scope, principalId, { id, deleted: false }, options);
    }

    public async paginatePayments(
        principalId: number,
        query: PaymentQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<Payment>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.paymentRepository.paginateVisible(
            scope,
            principalId,
            this.createPaymentQuery(query),
            options,
        );
    }

    // ─────────────────────────────────────────────────────────────────────────

    /** Il presidio del §3.7 — vedi la nota in testa alla classe. */
    private async assertFreeConfirmationAllowed(
        principalId: number,
        order: OrderWithContext,
        dto: OrderConfirmFreeDTO,
    ): Promise<void> {
        if (order.total === 0) {
            return;
        }

        if (!dto.offPlatformPayment) {
            Log.warn(
                `[OrderFulfilment Service]: confirm-free refused on order (id ${order.id}) — total is ${order.total} cents `
                + "and no off-platform payment was declared",
            );
            throw new httpErrors.BadRequest(
                "Questo ordine non è a importo zero: la conferma senza prestatore richiede la dichiarazione "
                + "esplicita di incasso fuori piattaforma da parte dell'organizzatore.",
            );
        }

        if (!dto.offPlatformReason) {
            Log.warn(`[OrderFulfilment Service]: confirm-free refused on order (id ${order.id}) — off-platform payment declared without a reason`);
            throw new httpErrors.BadRequest(
                "Dichiarare l'incasso fuori piattaforma richiede di indicare come e quando è avvenuto.",
            );
        }

        // Un partecipante non può dichiarare di aver pagato: lo dichiara chi incassa.
        const scope = await this.organizationScopeService.resolve(principalId);
        if (scope !== null && !scope.includes(order.organizationId)) {
            Log.warn(
                `[OrderFulfilment Service]: confirm-free refused — user (id ${principalId}) is not a member of `
                + `organization (id ${order.organizationId}) and cannot declare an off-platform payment`,
            );
            throw new httpErrors.Forbidden(
                "Solo un membro dell'organizzazione che incassa può dichiarare un pagamento fuori piattaforma.",
            );
        }
    }

    /** Si conferma solo ciò che è **ancora impegnato** — vedi la nota in testa alla classe. */
    private async assertReservationStillHeld(order: OrderWithContext): Promise<void> {
        const active = order.reservations.find(reservation => !reservation.releasedAt);

        if (!active) {
            Log.warn(`[OrderFulfilment Service]: fulfilment refused — order (id ${order.id}) has no active reservation`);
            throw domainError(
                DomainErrorCode.RESERVATION_EXPIRED,
                "La prenotazione di questo ordine è stata liberata: i posti non sono più impegnati.",
            );
        }

        if (active.expiresAt.getTime() <= Date.now()) {
            Log.warn(
                `[OrderFulfilment Service]: fulfilment refused — reservation (id ${active.id}) of order (id ${order.id}) `
                + `expired at ${active.expiresAt.toISOString()}`,
            );
            throw domainError(
                DomainErrorCode.RESERVATION_EXPIRED,
                "La prenotazione è scaduta: i posti sono tornati disponibili e l'ordine non può essere confermato.",
            );
        }
    }

    private async publishPaymentSucceeded(order: OrderWithContext): Promise<void> {
        try {
            const buyer = await this.userRepository.findOne({ id: order.purchase.buyerUserId });
            if (!buyer?.wsCode) {
                return;
            }
            const payload: PaymentSucceededPayloadDTO = { purchaseId: order.purchaseId, orderId: order.id };
            // Solo `sendToUser`, all'acquirente (§3.9).
            await this.wsPublisher.sendToUser(buyer.wsCode, Events.PAYMENT_SUCCEEDED, payload);
        } catch (err) {
            Log.error(
                `[OrderFulfilment Service]: failed to publish 'payment/succeeded' for order (id ${order.id}): `
                + `${(err as Error).message}`,
            );
        }
    }

    private createPaymentQuery(payload: PaymentQueryDTO): Prisma.PaymentWhereInput {
        const query: Prisma.PaymentWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.orderId, { orderId: payload.orderId }),
            createObjectWithoutThrow(payload.status, { status: payload.status }),
            createObjectWithoutThrow(payload.value, {
                providerPaymentId: { contains: payload.value ?? "", mode: "insensitive" as const },
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
