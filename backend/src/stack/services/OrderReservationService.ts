import { Service } from "fastify-decorators";
import { OrderStatus, Prisma, ReleaseReason, Reservation, User } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { domainError } from "@utils/helpers/domainError";
import { registrationIdsOfLines } from "@utils/helpers/orderAttendees";
import { DomainErrorCode } from "@enums/DomainErrorCode";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { ReservationQueryDTO } from "@DTOs/order/OrderQueryDTO";
import { ReservationRepository } from "@repositories/ReservationRepository";
import { OrderRepository, OrderWithContext } from "@repositories/OrderRepository";
import { OrderLineRepository } from "@repositories/OrderLineRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { UserRepository } from "@repositories/UserRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CheckoutPolicyService } from "@services/CheckoutPolicyService";
import { CapacityEngineService } from "@services/CapacityEngineService";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { MailService } from "@mail/MailService";
import { readI18nText } from "@utils/helpers/i18nText";
import { Events } from "@websocket/events/Events";
import { OrderReservationExpiredPayloadDTO } from "@websocket/dtos/OrderReservationExpiredPayloadDTO";

/** Quante prenotazioni scadute lo scheduler tratta in una passata (`R1b`). */
const EXPIRY_BATCH_SIZE = 200;

/** Esito di una passata dello scheduler, per il log e per la rotta manuale del `CronController`. */
export type ReservationSweepOutcome = {
    examined: number;
    released: number;
    releasedRegistrations: number;
};

/**
 * # La prenotazione — backend-brief §4.11, `RF-PAY-22`→`RF-PAY-25`
 *
 * Quindici minuti di capienza tolta dalla sala. Un servizio a sé perché la
 * prenotazione ha un **ciclo di vita proprio**, indipendente dall'ordine che la
 * possiede: nasce con `reserve`, si allunga con `rearm`, muore con `abandon`,
 * con la conferma, oppure da sola quando scade. Tenerla dentro `OrderService`
 * significherebbe che ogni percorso dell'ordine deve ricordarsi di lei; qui c'è
 * un solo posto in cui si sbaglia.
 *
 * ── I quattro vincoli, e da dove vengono ─────────────────────────────────────
 *
 * 1. **`expiresAt = now + 15 min`, parametro di piattaforma e non scelta
 *    dell'organizzatore** (`RF-PAY-25`). La durata si legge da
 *    `CheckoutPolicyService`, dove non arriva alcun `eventId`: non c'è modo di
 *    farla dipendere dall'evento nemmeno volendo.
 * 2. **Sempre attiva su qualunque evento, indipendentemente dalla disponibilità
 *    residua** (`RF-PAY-25`). Non esiste un ramo «l'evento è grande, saltiamo la
 *    prenotazione»: la scarsità è una condizione che cambia fra il primo e il
 *    quindicesimo minuto, e un impegno che valesse solo sugli eventi scarsi
 *    lascerebbe la capienza non impegnata proprio dove nessuno la sta guardando.
 * 3. **Una sola prenotazione attiva per `(userId, eventId)`** (`RF-PAY-23`). Il
 *    presidio è **doppio**: l'indice unico parziale in migrazione — che è
 *    l'autorità, perché regge anche due richieste simultanee — e la verifica di
 *    questo servizio, che esiste per restituire `RESERVATION_ALREADY_ACTIVE`
 *    invece del `500` di una violazione di vincolo.
 * 4. **Il rilascio dell'abbandono è immediato** (`RF-PAY-24`). Nessuna coda,
 *    nessun differimento: chi lascia il carrello restituisce il posto subito,
 *    perché il posto vale nel momento in cui qualcun altro lo sta cercando.
 *
 * ── Quello che il rilascio NON fa alla conferma ──────────────────────────────
 * `releaseReason = COMPLETED` **non rilascia i consumi**: la capienza impegnata
 * diventa venduta, non torna disponibile. Il metodo che lo fa è `complete`, ed è
 * volutamente distinto da `abandon` — un errore in questo punto significherebbe
 * rimettere in vendita i posti di chi ha appena pagato.
 */
@Service()
export class OrderReservationService {
    constructor(
        private readonly reservationRepository: ReservationRepository,
        private readonly orderRepository: OrderRepository,
        private readonly orderLineRepository: OrderLineRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly userRepository: UserRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly checkoutPolicyService: CheckoutPolicyService,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly wsPublisher: WsPublisherService,
        private readonly mailService: MailService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Creazione — chiamata da `OrderService.reserve`, dentro la sua transazione
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * `RF-PAY-23` — verifica preliminare, da chiamare **prima** di scrivere
     * qualunque cosa.
     *
     * «Attiva» significa `releasedAt IS NULL`, lo stesso predicato dell'indice
     * unico parziale: finder e vincolo devono dire la stessa cosa, o il servizio
     * crederebbe di poter creare una riga che il database poi rifiuta.
     *
     * Una prenotazione **scaduta e non ancora rilasciata** conta come attiva —
     * lo dice l'indice, e il rimedio non è ignorarla ma abbandonarla o attendere
     * lo scheduler. Il messaggio lo dichiara, perché un utente che ha appena
     * chiuso una scheda deve capire che cosa lo sta bloccando.
     */
    public async assertNoActiveReservation(
        userId: number,
        eventId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<void> {
        const active = await this.reservationRepository.findActive(userId, eventId, tx);
        if (!active) {
            return;
        }

        const expired = active.expiresAt.getTime() <= Date.now();
        Log.warn(
            `[OrderReservation Service]: reserve refused for user (id ${userId}) on event (id ${eventId}) — `
            + `reservation (id ${active.id}, order ${active.orderId}) is still active`
            + `${expired ? " but already expired: the scheduler has not swept it yet" : ""}`,
        );

        throw domainError(
            DomainErrorCode.RESERVATION_ALREADY_ACTIVE,
            expired
                ? "Hai già una prenotazione su questo evento, scaduta e non ancora liberata. Abbandonala per ricominciare."
                : "Hai già una prenotazione in corso su questo evento: completala o abbandonala prima di iniziarne un'altra.",
            409,
            { eventId, orderId: active.orderId, reservationId: active.id, expiresAt: active.expiresAt },
        );
    }

    /**
     * Crea la prenotazione dei quindici minuti. `tx` è **obbligatorio**: la
     * prenotazione non esiste senza l'ordine e l'impegno di capienza che la
     * giustificano, e valgono tutti insieme o nessuno.
     */
    public async create(
        input: { orderId: number; eventId: number; userId: number; expiresAt: Date },
        tx: Prisma.TransactionClient,
    ): Promise<Reservation> {
        const reservation = await this.reservationRepository.save(
            {
                orderId: input.orderId,
                eventId: input.eventId,
                userId: input.userId,
                expiresAt: input.expiresAt,
            },
            tx,
        );

        Log.info(
            `[OrderReservation Service]: reservation (id ${reservation.id}) created for user (id ${input.userId}) `
            + `on event (id ${input.eventId}), order (id ${input.orderId}) — expires at ${input.expiresAt.toISOString()}`,
        );
        return reservation;
    }

    /** `now + reservationMinutes`, letto dai parametri di piattaforma (`RF-PAY-25`). */
    public async expiryFrom(now: Date, tx?: Prisma.TransactionClient): Promise<Date> {
        const minutes = await this.checkoutPolicyService.reservationMinutes(tx);
        return new Date(now.getTime() + minutes * 60_000);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // `POST /orders/:id/rearm` — `RF-PAY-22`
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Riporta la scadenza ad **almeno dieci minuti residui**, all'avvio del
     * pagamento. Copre il reindirizzamento verso il prestatore: chi parte con due
     * minuti residui e viene rimandato su 3-D Secure tornerebbe a impegno già
     * scaduto, e pagherebbe posti che non ha più.
     *
     * **Non accorcia mai.** Se la prenotazione ha ancora dodici minuti resta a
     * dodici: il riarmo è un pavimento, non un valore.
     *
     * Una prenotazione **già scaduta non si riarma**: `RESERVATION_EXPIRED`. Un
     * riarmo che resuscitasse un impegno scaduto rimetterebbe in carrello posti
     * che nel frattempo il sistema ha il diritto di aver venduto a un altro.
     */
    public async rearm(principalId: number, orderId: number): Promise<Reservation> {
        const order = await this.findOrderForActorOrThrow(principalId, orderId);
        const minutes = await this.checkoutPolicyService.rearmMinutes();

        const reservation = await getPrismaClient().$transaction(async prisma => {
            const active = await this.reservationRepository.findActiveByOrder(orderId, prisma);
            if (!active) {
                Log.warn(`[OrderReservation Service]: rearm refused — order (id ${orderId}) has no active reservation`);
                throw domainError(
                    DomainErrorCode.RESERVATION_EXPIRED,
                    "La prenotazione di questo ordine è già stata liberata: i posti non sono più impegnati.",
                );
            }

            const now = new Date();
            if (active.expiresAt.getTime() <= now.getTime()) {
                Log.warn(
                    `[OrderReservation Service]: rearm refused — reservation (id ${active.id}) expired at `
                    + `${active.expiresAt.toISOString()} and must not be resurrected`,
                );
                throw domainError(
                    DomainErrorCode.RESERVATION_EXPIRED,
                    "La prenotazione è scaduta: i quindici minuti sono trascorsi e i posti sono tornati disponibili.",
                );
            }

            const floor = new Date(now.getTime() + minutes * 60_000);
            const expiresAt = active.expiresAt.getTime() >= floor.getTime() ? active.expiresAt : floor;

            const updated = await this.reservationRepository.update(
                { id: active.id },
                { expiresAt, rearmedAt: now },
                undefined,
                undefined,
                prisma,
            );
            // L'ordine porta la stessa scadenza: è il campo che il frontend legge
            // per il conto alla rovescia, e due scadenze diverse sulla stessa
            // attesa sarebbero due verità.
            await this.orderRepository.update({ id: orderId }, { expiresAt }, undefined, undefined, prisma);

            Log.info(
                `[OrderReservation Service]: reservation (id ${active.id}) of order (id ${orderId}) rearmed to `
                + `${expiresAt.toISOString()} (floor of ${minutes} minute(s)`
                + `${expiresAt === active.expiresAt ? ", already above it: unchanged" : ""})`,
            );
            return updated;
        });

        Log.debug(`[OrderReservation Service]: rearm completed on event (id ${order.eventId})`);
        return reservation;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // `POST /orders/:id/abandon` — `RF-PAY-24`
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * **Rilascio immediato.** In una sola transazione: si liberano *esattamente*
     * i consumi delle iscrizioni dell'ordine, si chiude la prenotazione con
     * `ABANDONED` e l'ordine passa a `CANCELLED`.
     *
     * Le iscrizioni non vengono cancellate ma marcate `deleted`: un ordine
     * abbandonato ha comunque prodotto un tentativo, e cancellare la riga
     * renderebbe non ricostruibile il perché di un contatore che si è mosso due
     * volte. I consumi, quelli sì, spariscono — il registro deve descrivere solo
     * ciò che occupa la sala adesso.
     */
    public async abandon(principalId: number, orderId: number): Promise<Reservation | null> {
        const order = await this.findOrderForActorOrThrow(principalId, orderId);

        if (order.status !== OrderStatus.PENDING_PAYMENT) {
            Log.warn(`[OrderReservation Service]: abandon refused — order (id ${orderId}) is ${order.status}, not PENDING_PAYMENT`);
            throw new httpErrors.BadRequest("Solo un ordine in attesa di pagamento può essere abbandonato.");
        }

        const outcome = await getPrismaClient().$transaction(async prisma => {
            const lines = await this.orderLineRepository.findByOrder(orderId, prisma);
            const registrationIds = registrationIdsOfLines(lines);

            const released = registrationIds.length
                ? await this.capacityEngineService.releaseRegistrations(registrationIds, prisma)
                : null;
            await this.retireRegistrations(registrationIds, prisma);

            const active = await this.reservationRepository.findActiveByOrder(orderId, prisma);
            const reservation = active
                ? await this.reservationRepository.update(
                    { id: active.id },
                    { releasedAt: new Date(), releaseReason: ReleaseReason.ABANDONED },
                    undefined,
                    undefined,
                    prisma,
                )
                : null;

            await this.orderRepository.update(
                { id: orderId },
                { status: OrderStatus.CANCELLED, cancelledAt: new Date(), expiresAt: null },
                undefined,
                undefined,
                prisma,
            );

            return { reservation, registrationIds, releasedQuantity: released?.releasedQuantity ?? 0 };
        });

        Log.info(
            `[OrderReservation Service]: order (id ${orderId}) abandoned on event (id ${order.eventId}) — `
            + `${outcome.releasedQuantity} unit(s) released across ${outcome.registrationIds.length} registration(s), `
            + "order CANCELLED (RF-PAY-24: release is immediate)",
        );
        return outcome.reservation;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Chiusura per pagamento riuscito — `releaseReason = COMPLETED`
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Chiude la prenotazione perché l'ordine è **saldato**.
     *
     * **Non tocca un solo contatore**: la capienza impegnata diventa venduta. È
     * l'unica differenza rispetto ad `abandon`, ed è la sola che conta — un
     * rilascio qui rimetterebbe in vendita i posti di chi ha appena pagato.
     */
    public async complete(orderId: number, tx: Prisma.TransactionClient): Promise<Reservation | null> {
        const active = await this.reservationRepository.findActiveByOrder(orderId, tx);
        if (!active) {
            Log.debug(`[OrderReservation Service]: order (id ${orderId}) has no active reservation to complete — nothing to do`);
            return null;
        }

        const reservation = await this.reservationRepository.update(
            { id: active.id },
            { releasedAt: new Date(), releaseReason: ReleaseReason.COMPLETED },
            undefined,
            undefined,
            tx,
        );

        Log.info(
            `[OrderReservation Service]: reservation (id ${active.id}) of order (id ${orderId}) closed as COMPLETED — `
            + "the committed capacity stays committed, it is now sold",
        );
        return reservation;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lo scheduler — `RF-PAY-24`, rischio `R1b`
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Recupera le prenotazioni **scadute e non rilasciate** e ne libera i
     * consumi.
     *
     * *Senza di esso, in apertura vendite i posti restano bloccati da ordini
     * abbandonati*: è il rischio `R1b`, dichiarato nell'analisi, e non è un caso
     * limite — è ciò che accade ogni volta che qualcuno chiude una scheda.
     *
     * ── Perché una transazione per prenotazione, e non una sola ──────────────
     * Una passata può trovare l'arretrato di una notte. Una transazione unica lo
     * terrebbe aperto per tutto il tempo, tenendo i lock sulle quote proprio
     * mentre riaprono le vendite. Ogni prenotazione è invece un'unità di lavoro
     * indipendente: se una fallisce, le altre passano lo stesso e la sua tornerà
     * nel lotto successivo.
     *
     * Il segnale WebSocket parte **dopo** il commit, mai dentro (§3.9).
     */
    public async releaseExpired(limit: number = EXPIRY_BATCH_SIZE): Promise<ReservationSweepOutcome> {
        const now = new Date();
        const expired = await this.reservationRepository.findExpiredUnreleased(now, limit);

        if (!expired.length) {
            Log.debug(`[OrderReservation Service]: expiry sweep found no expired reservation at ${now.toISOString()}`);
            return { examined: 0, released: 0, releasedRegistrations: 0 };
        }

        Log.info(`[OrderReservation Service]: expiry sweep started — ${expired.length} expired reservation(s) to release`);

        const notify: {
            buyerUserId: number;
            orderId: number;
            eventId: number;
            eventTitle: string;
            eventSlug: string;
        }[] = [];
        let released = 0;
        let releasedRegistrations = 0;

        for (const reservation of expired) {
            try {
                const registrationIds = registrationIdsOfLines(reservation.order.lines);

                await getPrismaClient().$transaction(async prisma => {
                    if (registrationIds.length) {
                        await this.capacityEngineService.releaseRegistrations(registrationIds, prisma);
                    }
                    await this.retireRegistrations(registrationIds, prisma);

                    await this.reservationRepository.update(
                        { id: reservation.id },
                        { releasedAt: new Date(), releaseReason: ReleaseReason.EXPIRED },
                        undefined,
                        undefined,
                        prisma,
                    );

                    // Un ordine la cui prenotazione è scaduta non è annullato da
                    // qualcuno: è scaduto. Gli stati dicono cose diverse e il
                    // cruscotto dell'organizzatore li legge (§4.11).
                    if (reservation.order.status === OrderStatus.PENDING_PAYMENT) {
                        await this.orderRepository.update(
                            { id: reservation.orderId },
                            { status: OrderStatus.EXPIRED, expiresAt: null },
                            undefined,
                            undefined,
                            prisma,
                        );
                    }
                });

                released += 1;
                releasedRegistrations += registrationIds.length;
                notify.push({
                    buyerUserId: reservation.order.purchase.buyerUserId,
                    orderId: reservation.orderId,
                    eventId: reservation.eventId,
                    eventTitle: readI18nText(reservation.order.event.title) ?? reservation.order.event.slug,
                    eventSlug: reservation.order.event.slug,
                });

                Log.info(
                    `[OrderReservation Service]: reservation (id ${reservation.id}) of order (id ${reservation.orderId}) `
                    + `released as EXPIRED — ${registrationIds.length} registration(s) freed on event (id ${reservation.eventId})`,
                );
            } catch (err) {
                Log.error(
                    `[OrderReservation Service]: expiry sweep failed on reservation (id ${reservation.id}): `
                    + `${(err as Error).message} — the row stays unreleased and returns in the next pass`,
                );
            }
        }

        // Dopo il commit, mai dentro (§3.9) — e vale identico per l'email.
        for (const target of notify) {
            await this.publishReservationExpired(target);
            await this.mailExpired(target);
        }

        Log.info(
            `[OrderReservation Service]: expiry sweep completed — ${released} of ${expired.length} reservation(s) released, `
            + `${releasedRegistrations} registration(s) freed`,
        );
        return { examined: expired.length, released, releasedRegistrations };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sola lettura (§3.4) — `Reservation` non si crea né si modifica da fuori
    // ─────────────────────────────────────────────────────────────────────────

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Reservation | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.reservationRepository.findOneVisible(scope, principalId, { id }, options);
    }

    public async paginate(
        principalId: number,
        query: ReservationQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<Reservation>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.reservationRepository.paginateVisible(
            scope,
            principalId,
            this.createQueryFromPayload(query),
            options,
        );
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Chi può agire su una prenotazione: **l'acquirente** o lo **staff
     * dell'organizzazione che incassa**, e nessun altro (§1.5). Il permesso di
     * rotta non basta: senza questo filtro un `DANCER` qualunque potrebbe
     * abbandonare l'ordine di un altro, che è un modo per liberargli il posto.
     */
    private async findOrderForActorOrThrow(principalId: number, orderId: number): Promise<OrderWithContext> {
        const order = await this.orderRepository.findWithContext(orderId);
        if (!order) {
            Log.warn(`[OrderReservation Service]: order (id ${orderId}) not found`);
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
            `[OrderReservation Service]: user (id ${principalId}) is neither the buyer of order (id ${orderId}) `
            + `nor a member of organization (id ${order.organizationId})`,
        );
        throw new httpErrors.NotFound("Ordine non trovato.");
    }

    /**
     * Le iscrizioni di un ordine che non sarà mai pagato escono di scena.
     *
     * **Marcate `deleted`, non cancellate**: l'ordine ha comunque prodotto un
     * tentativo, e cancellare la riga renderebbe non ricostruibile il perché di
     * un contatore che si è mosso due volte. I *consumi*, quelli sì, spariscono —
     * il registro deve descrivere solo ciò che occupa la sala adesso. Lasciarle
     * invece attive le farebbe comparire fra gli iscritti dell'evento, che è
     * esattamente ciò che l'organizzatore non deve vedere di un carrello
     * abbandonato.
     */
    private async retireRegistrations(registrationIds: number[], tx: Prisma.TransactionClient): Promise<void> {
        for (const registrationId of registrationIds) {
            await this.registrationRepository.update(
                { id: registrationId },
                { deleted: true },
                undefined,
                undefined,
                tx,
            );
        }
        if (registrationIds.length) {
            Log.debug(`[OrderReservation Service]: registration(s) [${registrationIds.join(", ")}] marked deleted after release`);
        }
    }

    /**
     * **«I quindici minuti sono trascorsi»** (`RF-COM-1`).
     *
     * Il segnale WebSocket arriva solo a chi ha la pagina aperta; questa email
     * arriva a chi l'ha chiusa ed è andato a cena — cioè quasi sempre. E dice
     * soprattutto una cosa: **non è stato addebitato nulla**. È la prima
     * domanda che si fa chi riceve un messaggio con scritto «scaduta», e
     * lasciarla senza risposta genera un ticket di assistenza per ogni invio.
     */
    private async mailExpired(target: {
        buyerUserId: number;
        eventTitle: string;
        eventSlug: string;
    }): Promise<void> {
        try {
            const buyer = await this.userRepository.findById(target.buyerUserId, {
                populate: "person person.contact",
            }) as (User & { person?: { name?: string; contact?: { email?: string } } }) | null;

            const email = buyer?.person?.contact?.email;
            if (!email) return;

            await this.mailService.sendReservationExpired(email, {
                firstName: buyer?.person?.name ?? "",
                eventTitle: target.eventTitle,
                eventSlug: target.eventSlug,
            });
        } catch (err) {
            Log.error(
                `[OrderReservation Service]: failed to mail expiry to buyer (id ${target.buyerUserId}): `
                + `${(err as Error).message}`,
            );
        }
    }

    private async publishReservationExpired(target: { buyerUserId: number; orderId: number; eventId: number }): Promise<void> {
        try {
            const buyer = await this.userRepository.findOne({ id: target.buyerUserId });
            if (!buyer?.wsCode) {
                return;
            }
            const payload: OrderReservationExpiredPayloadDTO = { orderId: target.orderId, eventId: target.eventId };
            // Solo `sendToUser`: la prenotazione scaduta riguarda l'acquirente e
            // nessun altro, e un broadcast per ruolo la manderebbe a mezza
            // piattaforma (§3.9).
            await this.wsPublisher.sendToUser(buyer.wsCode, Events.ORDER_RESERVATION_EXPIRED, payload);
        } catch (err) {
            // Il segnale è un trigger di refetch: la sua perdita non può far
            // fallire un rilascio già scritto.
            Log.error(
                `[OrderReservation Service]: failed to publish 'order/reservation-expired' for order `
                + `(id ${target.orderId}): ${(err as Error).message}`,
            );
        }
    }

    private createQueryFromPayload(payload: ReservationQueryDTO): Prisma.ReservationWhereInput {
        const query: Prisma.ReservationWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.userId, { userId: payload.userId }),
            createObjectWithoutThrow(payload.orderId, { orderId: payload.orderId }),
            payload.active === undefined ? {} : { releasedAt: payload.active ? null : { not: null } },
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
