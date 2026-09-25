import { Service } from "fastify-decorators";
import { Activity, ActivityKind, ActivitySeverity, ExternalSale, Prospect, SalesChannel } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { currentActor } from "@utils/adapters/requestContext";
import { readI18nText } from "@utils/helpers/i18nText";
import { ActivityRepository } from "@repositories/ActivityRepository";
import { CheckInRepository } from "@repositories/CheckInRepository";
import { RegistrationRepository } from "@repositories/RegistrationRepository";
import { EventRepository } from "@repositories/EventRepository";
import { SessionRepository } from "@repositories/SessionRepository";
import { UserRepository } from "@repositories/UserRepository";
import { OrganizationAudienceService } from "@services/OrganizationAudienceService";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { ActivityRecordedPayloadDTO } from "@websocket/dtos/ActivityRecordedPayloadDTO";

/** La cronaca recente, non l'archivio (`21-dashboard.md` §4). */
const RETENTION_DAYS = 30;
/** La pulizia gira al più una volta l'ora per processo, in lettura: non serve un lavoro pianificato. */
const PURGE_EVERY_MS = 3_600_000;
/** Un carrello da dieci persone è una riga, non dieci. */
const REGISTRATIONS_ONE_BY_ONE = 3;

type Row = {
    organizationId: number;
    kind: ActivityKind;
    text: string;
    severity?: ActivitySeverity;
    amount?: number | null;
    eventId?: number | null;
    staff?: boolean;
};

const whenFmt = new Intl.DateTimeFormat("it-IT", {
    timeZone: process.env.TIMEZONE ?? "Europe/Rome",
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
});

/** «giovedì 8 ottobre alle 18:30»: come lo si dice, nel fuso della scuola. */
export function whenText(at: Date): string {
    // `Intl` scrive «giovedì 21 ottobre alle ore 18:30»: «alle ore» è da modulo.
    return whenFmt.format(at).replace(" alle ore ", " alle ").replace(/, (\d{1,2}:\d{2})$/, " alle $1");
}

/** Il titolo multilingua di un evento o di una sessione, in italiano. */
export function titleText(value: unknown): string {
    return readI18nText(value) ?? "";
}

const euroWhole = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euroCents = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

/** «70 €» per le cifre tonde, «70,50 €» altrimenti: mai «70,5 €». */
const euro = { format: (value: number) => (Number.isInteger(value) ? euroWhole : euroCents).format(value) };

/**
 * **Che cosa è successo, per un'organizzazione** — `21-dashboard.md` §4.
 *
 * Ogni metodo si chiama **dove oggi parte il segnale in tempo reale**, dopo la
 * scrittura, e compone da sé la frase: chi chiama passa solo gli identificativi
 * che ha già. Poi avvisa i membri con `activity/recorded`.
 *
 * **Non lancia mai.** L'ingresso, l'iscrizione o l'incasso sono già scritti: una
 * riga d'attività mancata non può farli fallire a posteriori.
 *
 * ⚠️ **Nei percorsi caldi si chiama senza aspettarla** (`void`): ingressi alla
 * porta, iscrizioni, vendite esterne, pagamenti, saldi. La persona alla porta e
 * l'email con i biglietti non devono attendere la Dashboard — la scrittura e la
 * risoluzione dei destinatari sono tre query in più, e messe davanti all'email
 * la ritardavano davvero. Si aspetta solo dove chi agisce è lo staff dal
 * calendario, e la riga deve esserci quando la pagina rilegge.
 */
@Service()
export class ActivityService {
    private lastPurge = 0;

    constructor(
        private readonly activityRepository: ActivityRepository,
        private readonly checkInRepository: CheckInRepository,
        private readonly registrationRepository: RegistrationRepository,
        private readonly eventRepository: EventRepository,
        private readonly sessionRepository: SessionRepository,
        private readonly userRepository: UserRepository,
        private readonly organizationAudienceService: OrganizationAudienceService,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly wsPublisher: WsPublisherService,
    ) {}

    // ── Lettura ──────────────────────────────────────────────────────────────

    /** Le ultime righe delle organizzazioni del chiamante. `staffOnly`: il «Registro di oggi». */
    public async recent(principalId: number, options: { since: Date; limit: number; staffOnly: boolean }): Promise<Activity[]> {
        await this.purgeIfDue();
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.activityRepository.findRecentInScope(scope, options.since, options.limit, options.staffOnly);
    }

    // ── Scritture, una per segnale ──────────────────────────────────────────

    public async checkIn(eventId: number, sessionId: number, detail: { reason: string; checkInId?: number; count?: number }): Promise<void> {
        await this.safely("check-in", async () => {
            const session = (await this.sessionRepository.findMany({ id: sessionId }, { include: { event: true } } as never))[0] as any;
            if (!session) return;
            const where = text18(session.name) || text18(session.event.title);
            if (detail.reason === "SYNCED") {
                await this.record({
                    organizationId: session.event.organizationId, kind: "CHECK_IN", eventId,
                    text: `${detail.count ?? 0} ingressi arrivati dalla coda offline · ${where}`,
                });
                return;
            }
            if (!detail.checkInId) return;
            const checkIn = (await this.checkInRepository.findMany({ id: detail.checkInId }, { include: { ticket: true } } as never))[0] as any;
            const holder = checkIn?.ticket ? `${checkIn.ticket.holderName} ${checkIn.ticket.holderSurname}`.trim() : "un biglietto";
            await this.record({
                organizationId: session.event.organizationId, kind: "CHECK_IN", eventId,
                text: detail.reason === "REVOKED" ? `Ingresso annullato: ${holder} · ${where}` : `Ingresso di ${holder} · ${where}`,
            });
        });
    }

    public async registrationsCreated(event: { id: number; organizationId: number }, registrationIds: number[]): Promise<void> {
        if (!registrationIds.length) return;
        await this.safely("registration", async () => {
            const title = await this.eventTitle(event.id);
            if (registrationIds.length > REGISTRATIONS_ONE_BY_ONE) {
                await this.record({
                    organizationId: event.organizationId, kind: "REGISTRATION", eventId: event.id,
                    text: `${registrationIds.length} nuove iscrizioni a ${title}`,
                });
                return;
            }
            const rows = await this.registrationRepository.findMany({ id: { in: registrationIds } });
            for (const row of rows) {
                await this.record({
                    organizationId: event.organizationId, kind: "REGISTRATION", eventId: event.id,
                    text: `Nuova iscrizione a ${title}: ${row.holderName} ${row.holderSurname} · ${roleLabel(row.declaredRole)}`,
                });
            }
        });
    }

    public async registrationUpdated(event: { id: number; organizationId: number }, registrationId: number, change: string): Promise<void> {
        const verb: Record<string, string> = {
            CONFIRMED: "Iscrizione confermata",
            DECLINED: "Iscrizione rifiutata",
            DELETED: "Iscrizione cancellata",
            ROLE_REASSIGNED: "Ruolo assegnato",
        };
        if (!verb[change]) return;
        await this.safely("registration", async () => {
            const row = (await this.registrationRepository.findMany({ id: registrationId }))[0];
            if (!row) return;
            const title = await this.eventTitle(event.id);
            const role = change === "ROLE_REASSIGNED" && row.assignedRole ? ` · ${roleLabel(row.assignedRole)}` : "";
            await this.record({
                organizationId: event.organizationId, kind: "REGISTRATION", eventId: event.id, staff: change !== "ROLE_REASSIGNED",
                text: `${verb[change]}: ${row.holderName} ${row.holderSurname} · ${title}${role}`,
            });
        });
    }

    public async balanceSettled(
        registration: { id: number; eventId: number; holderName: string; holderSurname: string },
        amount: number,
        conflict: boolean,
    ): Promise<void> {
        await this.safely("balance", async () => {
            const event = await this.eventRepository.findOne({ id: registration.eventId });
            if (!event) return;
            await this.record({
                organizationId: event.organizationId, kind: "PAYMENT", eventId: event.id, amount,
                severity: conflict ? "WARNING" : "INFO", staff: true,
                text: `Saldo di ${euro.format(amount / 100)} incassato alla cassa · ${registration.holderName} ${registration.holderSurname}, ${text18(event.title)}`
                    + (conflict ? " · doppio incasso da verificare" : ""),
            });
        });
    }

    public async externalSaleIngested(channel: SalesChannel, sale: ExternalSale, seats: number): Promise<void> {
        await this.safely("external sale", async () => {
            await this.record({
                organizationId: channel.organizationId, kind: "PAYMENT", eventId: sale.eventId, amount: sale.depositPaidAmount,
                text: `Vendita da ${channel.label}: ${seats} ${seats === 1 ? "titolo" : "titoli"}, ${euro.format(sale.depositPaidAmount / 100)}`,
            });
        });
    }

    public async externalSaleQuarantined(channel: SalesChannel, sale: ExternalSale, reason: string): Promise<void> {
        await this.safely("external sale", async () => {
            await this.record({
                organizationId: channel.organizationId, kind: "PAYMENT", eventId: sale.eventId, severity: "CRITICAL",
                text: `Vendita da ${channel.label} ferma, ordine ${sale.externalOrderNumber}: ${reason}`,
            });
        });
    }

    /** L'ordine pagato online: `payment/succeeded` avvisa solo chi compra, questa riga avvisa lo staff. */
    public async orderPaid(order: { id: number; organizationId: number; eventId: number; total: number }): Promise<void> {
        await this.safely("order", async () => {
            await this.record({
                organizationId: order.organizationId, kind: "PAYMENT", eventId: order.eventId, amount: order.total,
                text: `Ordine pagato online: ${euro.format(order.total / 100)} · ${await this.eventTitle(order.eventId)}`,
            });
        });
    }

    /** Un'azione dello staff sul calendario, già descritta da chi l'ha fatta. */
    public async calendar(organizationId: number, text: string, eventId?: number | null): Promise<void> {
        await this.safely("calendar", async () => {
            await this.record({ organizationId, kind: "CALENDAR", eventId, text, staff: true });
        });
    }

    public async prospect(prospect: Prospect): Promise<void> {
        await this.safely("prospect", async () => {
            await this.record({
                organizationId: prospect.organizationId, kind: "PROSPECT", eventId: prospect.sourceEventId, severity: "WARNING",
                text: `Nuovo contatto dall'open day di ${await this.eventTitle(prospect.sourceEventId)}: `
                    + `${prospect.name}${prospect.surname ? ` ${prospect.surname}` : ""}, da ricontattare`,
            });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────

    private async record(row: Row): Promise<void> {
        const actorName = row.staff ? await this.actorName() : null;
        const saved = await this.activityRepository.save({
            organizationId: row.organizationId,
            kind: row.kind,
            severity: row.severity ?? "INFO",
            text: row.text,
            actorName,
            staff: row.staff ?? false,
            amount: row.amount ?? null,
            eventId: row.eventId ?? null,
        });
        Log.debug(`[Activity Service]: recorded ${row.kind} activity (id ${saved.id}) for organization (id ${row.organizationId})`);

        const wsCodes = await this.organizationAudienceService.resolveMemberWsCodes(row.organizationId);
        if (wsCodes.length) {
            const payload: ActivityRecordedPayloadDTO = { organizationId: row.organizationId, kind: row.kind, severity: saved.severity };
            await this.wsPublisher.sendToUsers(wsCodes, Events.ACTIVITY_RECORDED, payload);
        }
    }

    /** «Marco T.»: il nome di chi sta facendo la richiesta, se è una richiesta. */
    private async actorName(): Promise<string | null> {
        const actorId = currentActor()?.actorId;
        if (!actorId) return null;
        const user = (await this.userRepository.findMany({ id: actorId }, { include: { person: true } } as never))[0] as any;
        if (!user?.person) return currentActor()?.actorUsername ?? null;
        return `${user.person.name} ${String(user.person.surname ?? "").charAt(0)}.`.trim();
    }

    private async eventTitle(eventId: number | null): Promise<string> {
        if (!eventId) return "un evento";
        const event = await this.eventRepository.findOne({ id: eventId });
        return event ? text18(event.title) : "un evento";
    }

    private async purgeIfDue(): Promise<void> {
        if (Date.now() - this.lastPurge < PURGE_EVERY_MS) return;
        this.lastPurge = Date.now();
        await this.safely("purge", async () => {
            const removed = await this.activityRepository.deleteOlderThan(new Date(Date.now() - RETENTION_DAYS * 86_400_000));
            if (removed) Log.info(`[Activity Service]: purged ${removed} activity row(s) older than ${RETENTION_DAYS} days`);
        });
    }

    private async safely(what: string, work: () => Promise<void>): Promise<void> {
        try {
            await work();
        } catch (err) {
            Log.error(`[Activity Service]: failed to record ${what} activity: ${(err as Error).message}`);
        }
    }
}

function text18(value: unknown): string {
    return readI18nText(value) ?? "";
}

function roleLabel(role: string | null | undefined): string {
    return role === "LEADER" ? "leader" : role === "FOLLOWER" ? "follower" : "ruolo da assegnare";
}
