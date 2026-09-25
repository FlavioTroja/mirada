import { Service } from "fastify-decorators";
import { DateTime } from "luxon";
import { Log } from "@utils/adapters/log";
import { CALENDAR_TIMEZONE } from "@utils/helpers/recurrence";
import { SessionRepository } from "@repositories/SessionRepository";
import { CheckInRepository } from "@repositories/CheckInRepository";
import { TicketRepository } from "@repositories/TicketRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { PaymentRepository } from "@repositories/PaymentRepository";
import { BalanceSettlementRepository } from "@repositories/BalanceSettlementRepository";
import { ExternalSaleRepository } from "@repositories/ExternalSaleRepository";
import { RequirementOutcomeRepository } from "@repositories/RequirementOutcomeRepository";
import { EventRepository } from "@repositories/EventRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { EventDashboardService } from "@services/EventDashboardService";
import { DashboardTodayDTO, TodaySessionDTO } from "@DTOs/dashboard/DashboardTodayDTO";

const QUARTERS_PER_DAY = 96;
const DAYS_OF_HISTORY = 8;

/**
 * **La giornata dell'organizzazione** — `21-dashboard.md` §3.
 *
 * Il cruscotto per evento risponde a «come va il festival?». Questa lettura
 * risponde a «che cosa sta succedendo oggi?»: le sessioni di oggi di ogni
 * corso ed evento, chi è entrato, chi si è iscritto, che cosa si è incassato,
 * che cosa va sistemato, e il prossimo evento.
 *
 * Il giorno è quello di Roma, non quello del server: a mezzanotte e mezza la
 * milonga di ieri non deve ancora sparire dalla Dashboard di chi sta alla porta,
 * ma nemmeno la lezione di domani deve comparire alle 23 per un fuso sbagliato.
 */
@Service()
export class DashboardTodayService {
    constructor(
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly sessionRepository: SessionRepository,
        private readonly checkInRepository: CheckInRepository,
        private readonly ticketRepository: TicketRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly paymentRepository: PaymentRepository,
        private readonly balanceSettlementRepository: BalanceSettlementRepository,
        private readonly externalSaleRepository: ExternalSaleRepository,
        private readonly requirementOutcomeRepository: RequirementOutcomeRepository,
        private readonly eventRepository: EventRepository,
        private readonly eventDashboardService: EventDashboardService,
    ) {}

    public async today(principalId: number, now: Date = new Date()): Promise<DashboardTodayDTO> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const local = DateTime.fromJSDate(now, { zone: CALENDAR_TIMEZONE });
        const dayStart = local.startOf("day");
        const from = dayStart.toJSDate();
        const to = dayStart.plus({ days: 1 }).toJSDate();

        Log.info(`[DashboardToday Service]: building today's dashboard (${dayStart.toISODate()}) for user (id ${principalId})`);

        const [sessions, registrations, payments, settlements, externalSales, balances, todo, next] = await Promise.all([
            this.buildSessions(scope, from, to, now),
            this.registrationRepository.findCreatedSinceInScope(scope, dayStart.minus({ days: DAYS_OF_HISTORY - 1 }).toJSDate()),
            this.paymentRepository.findSucceededForOrdersPaidBetween(scope, from, to),
            this.balanceSettlementRepository.findCollectedBetweenInScope(scope, from, to),
            this.externalSaleRepository.findIngestedBetweenInScope(scope, from, to),
            this.registrationRepository.findOpenBalancesInScope(scope, now),
            this.buildTodo(scope, now),
            this.eventRepository.findNextInScope(scope, now),
        ]);

        // ── Ingressi per quarto d'ora ──────────────────────────────────────
        const entriesByQuarter = new Array<number>(QUARTERS_PER_DAY).fill(0);
        for (const at of sessions.entryTimes) {
            const index = Math.floor(minutesSince(dayStart, at) / 15);
            if (index >= 0 && index < QUARTERS_PER_DAY) entriesByQuarter[index]! += 1;
        }

        // ── Iscrizioni ─────────────────────────────────────────────────────
        const lastDays = new Array<number>(DAYS_OF_HISTORY).fill(0);
        const byFamily = { EVENT: 0, COURSE: 0 };
        const byChannel: Record<string, number> = {};
        for (const row of registrations) {
            const daysAgo = Math.floor(dayStart.diff(DateTime.fromJSDate(row.createdAt, { zone: CALENDAR_TIMEZONE }).startOf("day"), "days").days);
            const slot = DAYS_OF_HISTORY - 1 - daysAgo;
            if (slot >= 0 && slot < DAYS_OF_HISTORY) lastDays[slot]! += 1;
            if (daysAgo === 0) {
                byFamily[row.event.eventType.family] += 1;
                byChannel[row.channel] = (byChannel[row.channel] ?? 0) + 1;
            }
        }

        // ── Incasso ────────────────────────────────────────────────────────
        const perHour = new Array<number>(24).fill(0);
        const addAt = (at: Date | null, amount: number) => {
            if (!at) return;
            const hour = Math.floor(minutesSince(dayStart, at) / 60);
            if (hour >= 0 && hour < 24) perHour[hour]! += amount;
        };
        const online = sum(payments.map(p => p.amount));
        const boxOffice = sum(settlements.map(s => s.amount));
        const externalShops = sum(externalSales.map(e => e.depositPaidAmount));
        payments.forEach(p => addAt(p.order.paidAt, p.amount));
        settlements.forEach(s => addAt(s.collectedAt, s.amount));
        externalSales.forEach(e => addAt(e.receivedAt, e.depositPaidAmount));
        const cumulativeByHour = perHour.map((_, i) => sum(perHour.slice(0, i + 1)));

        const open = balances.filter(b => b.balanceDueAmount > b.balanceSettledAmount);

        // ── Prossimo evento: il cruscotto per evento, riusato ──────────────
        const nextEvent = next
            ? {
                id: next.id,
                title: next.title,
                startAt: next.startAt,
                endAt: next.endAt,
                dashboard: await this.eventDashboardService.build(principalId, next.id),
            }
            : null;

        return {
            day: dayStart.toISODate()!,
            generatedAt: now,
            sessions: sessions.rows,
            inRoom: sum(sessions.rows.filter(s => s.phase === "ONGOING").map(s => s.entries ?? 0)),
            expectedToday: sum(sessions.rows.filter(s => s.family === "EVENT" && !s.cancelled).map(s => s.expected)),
            entriesByQuarter,
            registrations: { today: lastDays[DAYS_OF_HISTORY - 1]!, byFamily, byChannel, lastDays },
            money: {
                total: online + boxOffice + externalShops,
                online,
                boxOffice,
                externalShops,
                cumulativeByHour,
                openBalances: {
                    count: open.length,
                    amount: sum(open.map(b => b.balanceDueAmount - b.balanceSettledAmount)),
                },
            },
            todo,
            nextEvent,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Le sessioni di oggi, con attesi e ingressi. Per una lezione gli attesi sono
     * gli iscritti al corso e gli ingressi non esistono (`RF-COR-6`); per una
     * sessione di evento gli attesi sono i biglietti validi che la comprendono.
     */
    private async buildSessions(scope: number[] | null, from: Date, to: Date, now: Date) {
        const sessions = await this.sessionRepository.findCalendarInScope(scope, from, to);
        const eventSessions = sessions.filter(s => s.event.eventType.family === "EVENT");
        const courseEventIds = [...new Set(sessions.filter(s => s.event.eventType.family === "COURSE").map(s => s.eventId))];

        const [entries, enrolled, tickets] = await Promise.all([
            this.checkInRepository.findValidForSessions(eventSessions.map(s => s.id)),
            this.registrationRepository.countActiveByEvents(courseEventIds),
            Promise.all(eventSessions.map(async s => [s.id, await this.ticketRepository.countValidIncludingSession(s.id)] as const)),
        ]);
        const ticketsBySession = new Map(tickets);

        const tally = new Map<number, { entries: number; leaders: number; followers: number }>();
        for (const entry of entries) {
            const row = tally.get(entry.sessionId) ?? { entries: 0, leaders: 0, followers: 0 };
            row.entries += 1;
            if (entry.registration?.assignedRole === "LEADER") row.leaders += 1;
            if (entry.registration?.assignedRole === "FOLLOWER") row.followers += 1;
            tally.set(entry.sessionId, row);
        }

        const rows: TodaySessionDTO[] = sessions.map(s => {
            const course = s.event.eventType.family === "COURSE";
            const counted = tally.get(s.id);
            return {
                id: s.id,
                eventId: s.eventId,
                eventTitle: s.event.title,
                name: s.name,
                family: s.event.eventType.family,
                kind: s.kind,
                isImplicit: s.isImplicit,
                room: s.room,
                venue: s.event.venue?.name ?? null,
                startAt: s.startAt,
                endAt: s.endAt,
                cancelled: !!s.cancelledAt || !!s.event.cancelledAt || s.event.status === "CANCELLED",
                phase: now < s.startAt ? "UPCOMING" : now < s.endAt ? "ONGOING" : "ENDED",
                expected: course ? enrolled.get(s.eventId) ?? 0 : ticketsBySession.get(s.id) ?? 0,
                entries: course ? null : counted?.entries ?? 0,
                leaders: course ? null : counted?.leaders ?? 0,
                followers: course ? null : counted?.followers ?? 0,
            };
        });

        return { rows, entryTimes: entries.map(e => e.scannedAt) };
    }

    private async buildTodo(scope: number[] | null, now: Date): Promise<DashboardTodayDTO["todo"]> {
        const [quarantinedSales, requirementsUnderReview, checkInConflicts, settlementConflicts] = await Promise.all([
            this.externalSaleRepository.countQuarantinedInScope(scope),
            this.requirementOutcomeRepository.countUnderReviewInScope(scope, now),
            this.checkInRepository.countOpenConflictsInScope(scope),
            this.balanceSettlementRepository.countConflictsInScope(scope),
        ]);
        return { quarantinedSales, requirementsUnderReview, checkInConflicts, settlementConflicts };
    }
}

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
}

function minutesSince(start: DateTime, at: Date): number {
    return (at.getTime() - start.toMillis()) / 60_000;
}
