import { Service } from "fastify-decorators";
import { CapacityQuota, DanceRole, DeclaredDanceRole, EventRequirement, Order, OrderLine, Payment, QuotaScope, Registration, RegistrationStatus, RequirementOutcomeStatus, Session } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { EventRepository } from "@repositories/EventRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { CapacityQuotaRepository } from "@repositories/CapacityQuotaRepository";
import { QuotaConsumptionRepository } from "@repositories/QuotaConsumptionRepository";
import { CoupleRepository } from "@repositories/CoupleRepository";
import { TicketTypeRepository } from "@repositories/TicketTypeRepository";
import { SessionRepository } from "@repositories/SessionRepository";
import { CheckInRepository } from "@repositories/CheckInRepository";
import { TicketRepository } from "@repositories/TicketRepository";
import {
    BLOCKING_OUTCOME_STATUSES,
    RequirementOutcomeRepository,
} from "@repositories/RequirementOutcomeRepository";
import { EventServiceRepository } from "@repositories/EventServiceRepository";
import { EventRequirementRepository } from "@repositories/EventRequirementRepository";
import { OrderRepository } from "@repositories/OrderRepository";
import { OrderLineRepository } from "@repositories/OrderLineRepository";
import { PaymentRepository } from "@repositories/PaymentRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { EventDashboardDTO } from "@DTOs/event/EventDashboardDTO";

/** Iscrizioni che contano: le stesse dell'invariante I6 del motore di capienza. */
const ACTIVE: RegistrationStatus[] = [RegistrationStatus.CONFIRMED, RegistrationStatus.TO_CONFIRM];

/**
 * Entità del §2 non ancora costruite. Ogni sezione che dipende da una di queste
 * è dichiarata indisponibile, mai riempita di zeri (`RB21`).
 */
const MISSING_ENTITIES = ["Refund"];

const PERIMETER_NOTE =
    "Il cruscotto è calcolato sulle sole entità costruite: Event, Registration, CapacityQuota, "
    + "QuotaConsumption, Couple, TicketType, EventService, EventRequirement, RequirementOutcome, "
    + "Ticket, PassIssuance, CheckIn, Purchase, Order, OrderLine, Reservation, Payment. "
    + "IMPEGNATO e VENDUTO restano due grandezze distinte e sono riportate separatamente (RB21): "
    + "il motore di capienza sottrae i posti anche a una prenotazione in corso, che alla scadenza "
    + "torna disponibile senza aver venduto nulla. Refund NON è ancora costruita, quindi gli "
    + "importi sono AL LORDO dei rimborsi. Le PRESENZE sono un asse a sé: il check-in non consuma "
    + "capienza (RB19), e il contatore di sala non va sommato ai contatori di quota.";

/**
 * `GET /events/:id/dashboard` — backend-brief §3.7 (`RF-BKO-1`, `RF-CPL-11`).
 *
 * Vive in un servizio proprio e non dentro `EventService` perché è una **lettura
 * di sola proiezione**: non partecipa ad alcuna transizione di stato dell'evento
 * e non scrive nulla.
 */
@Service()
export class EventDashboardService {
    constructor(
        private readonly eventRepository: EventRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly capacityQuotaRepository: CapacityQuotaRepository,
        private readonly quotaConsumptionRepository: QuotaConsumptionRepository,
        private readonly coupleRepository: CoupleRepository,
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly checkInRepository: CheckInRepository,
        private readonly ticketRepository: TicketRepository,
        private readonly requirementOutcomeRepository: RequirementOutcomeRepository,
        private readonly eventServiceRepository: EventServiceRepository,
        private readonly eventRequirementRepository: EventRequirementRepository,
        private readonly orderRepository: OrderRepository,
        private readonly orderLineRepository: OrderLineRepository,
        private readonly paymentRepository: PaymentRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async build(principalId: number, eventId: number): Promise<EventDashboardDTO> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[EventDashboard Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }

        Log.info(`[EventDashboard Service]: building dashboard for event '${event.slug}' (id ${eventId})`);

        const [registrations, quotas, couples, ticketTypes, eventServices, requirements, sessions] = await Promise.all([
            this.registrationRepository.findByEvent(eventId),
            this.capacityQuotaRepository.findByEvent(eventId),
            this.coupleRepository.findByEvent(eventId),
            this.ticketTypeRepository.findByEvent(eventId),
            this.eventServiceRepository.findByEvent(eventId),
            this.eventRequirementRepository.findByEvent(eventId),
            this.sessionRepository.findByEvent(eventId),
        ]);

        const active = registrations.filter(r => ACTIVE.includes(r.status));
        const committedByQuota = await this.quotaConsumptionRepository.sumByQuota(quotas.map(q => q.id));

        // Il denaro: solo ordini saldati, e su quelli le righe e gli incassi
        // riusciti. Tre letture, non una per ordine.
        const paidOrders = await this.orderRepository.findPaidByEvent(eventId);
        const paidOrderIds = paidOrders.map(o => o.id);
        const [paidLines, succeededPayments] = await Promise.all([
            this.orderLineRepository.findByOrders(paidOrderIds),
            this.paymentRepository.findSucceededByOrders(paidOrderIds),
        ]);

        const dashboard: EventDashboardDTO = {
            eventId: event.id,
            slug: event.slug,
            status: event.status,
            generatedAt: new Date(),
            perimeter: { note: PERIMETER_NOTE, missingEntities: MISSING_ENTITIES },
            sections: {
                registrationsByRole: this.buildRoles(active, quotas),
                capacity: this.buildCapacity(quotas, { ticketTypes, sessions, services: eventServices }),
                committedByTicketType: this.buildTicketTypes(ticketTypes, quotas, committedByQuota),
                committedServices: this.buildServices(eventServices, quotas, committedByQuota),
                couples: this.buildCouples(couples, active),
                requirements: this.buildRequirements(requirements),
                registrationsTrend: this.buildTrend(active),
                attendance: await this.buildAttendance(eventId, sessions),
                missingRequirements: await this.buildMissingRequirements(requirements, active),

                soldByTicketType: this.buildSold(ticketTypes, paidLines),
                netRevenue: this.buildRevenue(paidOrders, succeededPayments),
            },
        };

        Log.info(
            `[EventDashboard Service]: dashboard ready for event (id ${eventId}) — `
            + `${active.length} active registration(s), ${quotas.length} quota(s), ${couples.length} couple(s)`,
        );

        return dashboard;
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Iscritti per ruolo, sbilancio corrente e **tolleranza configurata**.
     * Lo sbilancio porta il segno: `> 0` = eccesso di leader.
     */
    private buildRoles(active: Registration[], quotas: CapacityQuota[]): EventDashboardDTO["sections"]["registrationsByRole"] {
        const leader = active.filter(r => r.assignedRole === DanceRole.LEADER).length;
        const follower = active.filter(r => r.assignedRole === DanceRole.FOLLOWER).length;
        const unassigned = active.filter(r => r.assignedRole === null).length;

        const roleQuotas = quotas.filter(
            q => q.scope === QuotaScope.EVENT && q.role !== null && q.reservedFor === null,
        );
        const tolerance = roleQuotas.map(q => q.imbalanceTolerance).find(t => t !== null) ?? null;

        return {
            available: true,
            basedOn: ["Registration", "CapacityQuota"],
            note:
                "Conteggi sulle iscrizioni attive (CONFIRMED, TO_CONFIRM) non cancellate — le stesse che "
                + "l'invariante I6 impone di trovare a contatore.",
            leader,
            follower,
            unassigned,
            total: active.length,
            declared: {
                LEADER: active.filter(r => r.declaredRole === DeclaredDanceRole.LEADER).length,
                FOLLOWER: active.filter(r => r.declaredRole === DeclaredDanceRole.FOLLOWER).length,
                FLEXIBLE: active.filter(r => r.declaredRole === DeclaredDanceRole.FLEXIBLE).length,
            },
            imbalance: leader - follower,
            imbalanceTolerance: tolerance,
            roleQuotas: roleQuotas.map(q => ({
                role: q.role as DanceRole,
                limit: q.limit,
                consumed: q.consumed,
                remaining: Math.max(0, q.limit + q.overbookAllowance - q.consumed),
                limiting: q.limiting,
            })),
        };
    }

    /**
     * @param named  I nomi delle entità a cui le quote si riferiscono, già
     *   caricati per le altre sezioni: nessuna lettura in più, e soprattutto
     *   nessuna lettura *per riga*.
     */
    private buildCapacity(
        quotas: CapacityQuota[],
        named: {
            ticketTypes: { id: number; name: unknown }[];
            sessions: { id: number; name: unknown; startAt: Date }[];
            services: { id: number; name: unknown }[];
        },
    ): EventDashboardDTO["sections"]["capacity"] {
        const room = quotas.find(
            q => q.scope === QuotaScope.EVENT && q.role === null && q.reservedFor === null,
        );

        // Una mappa per ambito: `scopeId` è univoco solo *dentro* il suo ambito,
        // e un titolo e una sessione possono benissimo avere lo stesso id.
        const byScope: Record<string, Map<number, unknown>> = {
            [QuotaScope.TICKET_TYPE]: new Map(named.ticketTypes.map(t => [t.id, t.name])),
            [QuotaScope.SESSION]: new Map(named.sessions.map(s => [s.id, s.name])),
            [QuotaScope.SERVICE]: new Map(named.services.map(s => [s.id, s.name])),
        };
        const nameOf = (scope: string, scopeId: number | null) =>
            scopeId === null ? null : (byScope[scope]?.get(scopeId) ?? null);

        // Solo per le sessioni: è l'unico ambito in cui lo stesso nome ricorre
        // legittimamente più volte nel programma.
        const sessionStart = new Map(named.sessions.map(s => [s.id, s.startAt]));
        const startOf = (scope: string, scopeId: number | null) =>
            scope === QuotaScope.SESSION && scopeId !== null
                ? (sessionStart.get(scopeId) ?? null)
                : null;

        return {
            available: true,
            basedOn: ["CapacityQuota"],
            note:
                "`consumed` è il contatore denormalizzato del motore, mosso nella stessa transazione dei "
                + "consumi. Assenza di quota significa assenza di vincolo, non zero posti: `room` è null "
                + "quando la capienza della sala non è configurata.",
            room: room
                ? {
                    limit: room.limit,
                    consumed: room.consumed,
                    remaining: Math.max(0, room.limit + room.overbookAllowance - room.consumed),
                }
                : null,
            quotas: quotas.map(q => ({
                id: q.id,
                scope: q.scope,
                scopeId: q.scopeId,
                scopeName: nameOf(q.scope, q.scopeId),
                scopeStartAt: startOf(q.scope, q.scopeId),
                role: q.role,
                reservedFor: q.reservedFor,
                limit: q.limit,
                consumed: q.consumed,
                remaining: Math.max(0, q.limit + q.overbookAllowance - q.consumed),
                limiting: q.limiting,
            })),
        };
    }

    /**
     * **Venduto per titolo.** Un giro sulle righe degli ordini saldati,
     * raggruppate per titolo.
     *
     * Un titolo mai venduto compare comunque, a zero: un elenco che salta le
     * righe vuote fa sembrare che quel titolo non esista, quando invece la
     * notizia è proprio che non lo compra nessuno.
     */
    private buildSold(
        ticketTypes: { id: number; name: unknown; basePrice: number }[],
        paidLines: OrderLine[],
    ): EventDashboardDTO["sections"]["soldByTicketType"] {
        const sold = new Map<number, { sold: number; gross: number }>();
        let servicesGross = 0;

        for (const line of paidLines) {
            if (line.ticketTypeId === null) {
                // Riga di servizio accessorio: è denaro incassato, ma non è un
                // biglietto e non va attribuito ad alcun titolo.
                servicesGross += line.lineTotal;
                continue;
            }
            const current = sold.get(line.ticketTypeId) ?? { sold: 0, gross: 0 };
            current.sold += line.quantity;
            current.gross += line.lineTotal;
            sold.set(line.ticketTypeId, current);
        }

        return {
            available: true,
            basedOn: ["TicketType", "Order", "OrderLine"],
            note:
                "Unità SALDATE (ordini in stato PAID), non impegnate: la sezione 'committedByTicketType' "
                + "riporta l'altra grandezza e le due divergono per tutta la durata di una prenotazione. "
                + "Importi in centesimi e AL LORDO dei rimborsi, che l'entità Refund non modella ancora.",
            items: ticketTypes.map(tt => ({
                ticketTypeId: tt.id,
                name: tt.name,
                basePrice: tt.basePrice,
                sold: sold.get(tt.id)?.sold ?? 0,
                gross: sold.get(tt.id)?.gross ?? 0,
            })),
            servicesGross,
        };
    }

    /**
     * **Il denaro.** `subtotal` all'organizzatore, `presaleRights` alla
     * piattaforma, `total` pagato dal compratore, `cashed` realmente transitato.
     *
     * `cashed` si legge dai `Payment` riusciti e non dai totali degli ordini,
     * perché sono due fatti diversi: un ordine a importo zero chiuso con
     * `confirm-free` è saldato senza che un centesimo si muova. Sommare i totali
     * e chiamarli incasso significherebbe annunciare denaro che non è mai
     * arrivato.
     */
    private buildRevenue(
        paidOrders: Order[],
        succeededPayments: Payment[],
    ): EventDashboardDTO["sections"]["netRevenue"] {
        const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

        return {
            available: true,
            basedOn: ["Order", "Payment"],
            note:
                "Solo ordini PAID. Importi in centesimi e AL LORDO dei rimborsi: Refund non è ancora "
                + "costruita, quindi nessuna restituzione è sottratta. 'cashed' può essere minore di "
                + "'total' perché gli ordini a importo zero si chiudono senza pagamento.",
            paidOrders: paidOrders.length,
            zeroAmountOrders: paidOrders.filter(o => o.total === 0).length,
            subtotal: sum(paidOrders.map(o => o.subtotal)),
            presaleRights: sum(paidOrders.map(o => o.presaleRights)),
            total: sum(paidOrders.map(o => o.total)),
            cashed: sum(succeededPayments.map(p => p.amount)),
        };
    }

    private buildTicketTypes(
        ticketTypes: { id: number; name: unknown; basePrice: number }[],
        quotas: CapacityQuota[],
        committedByQuota: Map<number, number>,
    ): EventDashboardDTO["sections"]["committedByTicketType"] {
        return {
            available: true,
            basedOn: ["TicketType", "CapacityQuota", "QuotaConsumption"],
            note:
                "Unità IMPEGNATE dal motore di capienza sulla quota di ambito TICKET_TYPE, non biglietti "
                + "venduti e pagati. `limit`, `committed` e `remaining` sono null quando il titolo non ha "
                + "una quota configurata: in quel caso il motore non tiene alcun contatore per esso.",
            items: ticketTypes.map(tt => {
                const quota = quotas.find(q => q.scope === QuotaScope.TICKET_TYPE && q.scopeId === tt.id);
                return {
                    ticketTypeId: tt.id,
                    name: tt.name,
                    basePrice: tt.basePrice,
                    limit: quota ? quota.limit : null,
                    committed: quota ? (committedByQuota.get(quota.id) ?? 0) : null,
                    remaining: quota ? Math.max(0, quota.limit + quota.overbookAllowance - quota.consumed) : null,
                };
            }),
        };
    }

    private buildServices(
        services: { id: number; name: unknown; price: number }[],
        quotas: CapacityQuota[],
        committedByQuota: Map<number, number>,
    ): EventDashboardDTO["sections"]["committedServices"] {
        return {
            available: true,
            basedOn: ["EventService", "CapacityQuota", "QuotaConsumption"],
            note:
                "Stessa avvertenza dei titoli: sono unità impegnate sulla quota di ambito SERVICE, non "
                + "servizi venduti e incassati.",
            items: services.map(svc => {
                const quota = quotas.find(q => q.scope === QuotaScope.SERVICE && q.scopeId === svc.id);
                return {
                    eventServiceId: svc.id,
                    name: svc.name,
                    price: svc.price,
                    limit: quota ? quota.limit : null,
                    committed: quota ? (committedByQuota.get(quota.id) ?? 0) : null,
                    remaining: quota ? Math.max(0, quota.limit + quota.overbookAllowance - quota.consumed) : null,
                };
            }),
        };
    }

    /**
     * Una coppia è **completa** quando non è sciolta e ha esattamente due
     * iscrizioni attive con ruoli assegnati complementari — la stessa condizione
     * che `CoupleService` fa rispettare in scrittura (`RF-CPL-11`).
     */
    private buildCouples(
        couples: { id: number; dissolvedAt: Date | null }[],
        active: Registration[],
    ): EventDashboardDTO["sections"]["couples"] {
        const dissolved = couples.filter(c => c.dissolvedAt !== null).length;
        let complete = 0;

        for (const couple of couples.filter(c => c.dissolvedAt === null)) {
            const members = active.filter(r => r.coupleId === couple.id);
            const roles = new Set(members.map(m => m.assignedRole));
            if (members.length === 2 && roles.has(DanceRole.LEADER) && roles.has(DanceRole.FOLLOWER)) {
                complete++;
            }
        }

        const live = couples.length - dissolved;
        return {
            available: true,
            basedOn: ["Couple", "Registration"],
            note: "Completa = non sciolta, due iscrizioni attive, ruoli assegnati complementari.",
            complete,
            incomplete: live - complete,
            dissolved,
            total: couples.length,
        };
    }

    private buildRequirements(
        requirements: { id: number; label: unknown; mandatory: boolean; blocking: string; verification: string }[],
    ): EventDashboardDTO["sections"]["requirements"] {
        return {
            available: true,
            basedOn: ["EventRequirement"],
            note:
                "Requisiti CONFIGURATI sull'evento. Quanti ne manchino, e a chi, è un dato di "
                + "RequirementOutcome: vedi la sezione 'missingRequirements'.",
            configured: requirements.map(r => ({
                eventRequirementId: r.id,
                label: r.label,
                mandatory: r.mandatory,
                blocking: r.blocking,
                verification: r.verification,
            })),
        };
    }

    /**
     * Andamento — **delle iscrizioni**, non delle vendite: senza `Order` non
     * esiste una data di incasso su cui costruire una curva di vendita.
     */
    private buildTrend(active: Registration[]): EventDashboardDTO["sections"]["registrationsTrend"] {
        const byDay = new Map<string, number>();
        for (const registration of active) {
            const day = registration.createdAt.toISOString().slice(0, 10);
            byDay.set(day, (byDay.get(day) ?? 0) + 1);
        }

        let cumulative = 0;
        const points = [...byDay.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => {
                cumulative += count;
                return { date, count, cumulative };
            });

        return {
            available: true,
            basedOn: ["Registration"],
            note:
                "Andamento delle ISCRIZIONI per giorno (Registration.createdAt, UTC). Non è la curva di "
                + "vendita: senza Order non esiste una data di incasso.",
            granularity: "DAY",
            points,
        };
    }

    /**
     * **Presenze** — `RB19`: un asse distinto dalle quote. Le quote governano
     * l'ammissione, questo contatore governa la sicurezza, e sommarli sarebbe un
     * errore con conseguenze fuori dal software.
     *
     * Si contano le righe **valide**: revocate escluse (`RF-CHK-9`, un ingresso
     * annullato non è mai avvenuto) e righe di conflitto escluse — ma i conflitti
     * aperti sono riportati a parte, perché un cruscotto che li nascondesse
     * mostrerebbe un numero plausibile su un dato che nessuno ha ancora dirimito
     * (`RF-CHK-6`).
     */
    private async buildAttendance(
        eventId: number,
        sessions: Session[],
    ): Promise<EventDashboardDTO["sections"]["attendance"]> {
        const bySession: EventDashboardDTO["sections"]["attendance"]["bySession"] = [];
        let totalEntries = 0;
        const tickets = new Set<number>();

        for (const session of sessions) {
            const entries = await this.checkInRepository.findBySession(session.id);
            const valid = entries.filter(entry => !entry.revokedAt && !entry.conflictWithId);
            for (const entry of valid) {
                tickets.add(entry.ticketId);
            }
            totalEntries += valid.length;
            bySession.push({
                sessionId: session.id,
                name: session.name,
                startAt: session.startAt,
                entries: valid.length,
            });
        }

        const openConflicts = (await this.checkInRepository.findOpenConflictsByEvent(eventId)).length;

        return {
            available: true,
            basedOn: ["CheckIn", "Session", "Ticket"],
            note:
                "Il check-in NON consuma capienza (RB19): questo contatore misura le persone presenti, "
                + "le quote misurano i posti impegnati. Le due grandezze non vanno sommate.",
            totalEntries,
            distinctTickets: tickets.size,
            openConflicts,
            bySession,
        };
    }

    /**
     * **Requisiti mancanti** — `RF-BKO-1`.
     *
     * «Mancante» è uno stato di `RequirementOutcome` **oppure l'assenza
     * dell'esito**: un requisito obbligatorio su cui nessuno ha dichiarato nulla
     * manca esattamente come uno rifiutato, e trattarlo come soddisfatto sarebbe
     * il modo più semplice per non accorgersene mai.
     *
     * `RB12` — nome del requisito e conteggio. Mai il contenuto degli esiti.
     */
    private async buildMissingRequirements(
        requirements: EventRequirement[],
        active: Registration[],
    ): Promise<EventDashboardDTO["sections"]["missingRequirements"]> {
        const mandatory = requirements.filter(requirement => requirement.mandatory);
        const registrationIds = active.map(registration => registration.id);

        if (!mandatory.length || !registrationIds.length) {
            return {
                available: true,
                basedOn: ["EventRequirement", "RequirementOutcome", "Registration"],
                registrationsWithMissing: 0,
                byRequirement: mandatory.map(requirement => ({
                    eventRequirementId: requirement.id,
                    label: requirement.label,
                    blocking: requirement.blocking,
                    mandatory: requirement.mandatory,
                    missing: registrationIds.length,
                })),
            };
        }

        const outcomes = await this.requirementOutcomeRepository.findByRegistrations(registrationIds);
        const byRegistration = new Map<number, Map<number, RequirementOutcomeStatus>>();
        for (const outcome of outcomes) {
            const map = byRegistration.get(outcome.registrationId) ?? new Map<number, RequirementOutcomeStatus>();
            map.set(outcome.eventRequirementId, outcome.status);
            byRegistration.set(outcome.registrationId, map);
        }

        const withMissing = new Set<number>();
        const byRequirement = mandatory.map(requirement => {
            let missing = 0;
            for (const registrationId of registrationIds) {
                const status = byRegistration.get(registrationId)?.get(requirement.id);
                if (!status || BLOCKING_OUTCOME_STATUSES.includes(status)) {
                    missing += 1;
                    withMissing.add(registrationId);
                }
            }
            return {
                eventRequirementId: requirement.id,
                label: requirement.label,
                blocking: requirement.blocking,
                mandatory: requirement.mandatory,
                missing,
            };
        });

        return {
            available: true,
            basedOn: ["EventRequirement", "RequirementOutcome", "Registration"],
            registrationsWithMissing: withMissing.size,
            byRequirement,
        };
    }
}
