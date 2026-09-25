import { Service } from "fastify-decorators";
import { Event, EventType, EventTypeFamily, Prisma, Session, SessionKind, TicketType } from "@prisma/client";
import { randomUUID } from "node:crypto";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { getPrismaClient } from "@utils/adapters/prisma";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { uniformAllocationWeight } from "@utils/helpers/allocationWeight";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { SessionRepository } from "@repositories/SessionRepository";
import { EventRepository } from "@repositories/EventRepository";
import { EventTypeRepository } from "@repositories/EventTypeRepository";
import { TicketTypeRepository } from "@repositories/TicketTypeRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { CapacityEngineService, ReleaseOutcome } from "@services/CapacityEngineService";
import { SessionCreateDTO } from "@DTOs/session/SessionCreateDTO";
import { SessionUpdateDTO } from "@DTOs/session/SessionUpdateDTO";
import { SessionQueryDTO } from "@DTOs/session/SessionQueryDTO";
import {
    ExtendedTicketTypeDTO,
    SessionScheduleDTO,
    SessionScheduleResultDTO,
} from "@DTOs/session/SessionScheduleDTO";
import { SessionSeriesUpdateDTO } from "@DTOs/session/SessionSeriesUpdateDTO";
import { SeriesDeletionDTO, SeriesScope } from "@DTOs/calendar/SeriesScopeDTO";
import { CalendarRangeDTO } from "@DTOs/calendar/CalendarRangeDTO";
import { TicketTypeSessionRepository } from "@repositories/TicketTypeSessionRepository";
import { CalendarBroadcastService } from "@services/CalendarBroadcastService";
import { expandWeekly, expansionErrorMessage, retime, sameLocalDay } from "@utils/helpers/recurrence";
import { ActivityService, titleText, whenText } from "@services/ActivityService";

/** Esito di `cancelSession` (§4.6 · `RF-EVT-35`). */
export type SessionCancellationDTO = {
    session: Session;
    /** Titoli che includono la sessione, con il peso di ripartizione che vi corrisponde. */
    affectedTicketTypes: { id: number; name: Prisma.JsonValue; allocationWeight: number }[];
    /** Quote della sessione rilasciate — riga per riga, mai «a occhio» (§4.6, `05` §8). */
    released: ReleaseOutcome;
};

@Service()
export class SessionService {
    constructor(
        private readonly sessionRepository: SessionRepository,
        private readonly eventRepository: EventRepository,
        private readonly eventTypeRepository: EventTypeRepository,
        private readonly ticketTypeRepository: TicketTypeRepository,
        private readonly organizationScopeService: OrganizationScopeService,
        private readonly capacityEngineService: CapacityEngineService,
        private readonly ticketTypeSessionRepository: TicketTypeSessionRepository,
        private readonly calendarBroadcastService: CalendarBroadcastService,
        private readonly activityService: ActivityService,
    ) {}

    /**
     * §4.6 — `allocationWeight` ha un **default uniforme calcolato dal servizio**
     * sul numero di sessioni (`RF-EVT-36`). Quando la sessione entra senza peso
     * esplicito il servizio riequilibra l'intero evento, ma **solo se nessuna
     * sessione porta ancora un peso scelto dall'organizzatore**: i pesi assegnati
     * a mano non vengono mai sovrascritti.
     */
    public async save(principalId: number, dto: SessionCreateDTO): Promise<Session> {
        const event = await this.assertWritableEvent(principalId, dto.eventId);
        this.assertDatesAreCoherent(dto.startAt, dto.endAt);

        const eventType = await this.eventTypeRepository.findOne({ id: event.eventTypeId });
        this.assertKindFitsEvent(dto.kind, eventType);
        const existing = await this.sessionRepository.findByEvent(event.id);
        this.assertRoomForSessions(event, eventType, existing, 1);

        Log.info(`[Session Service]: creating session on event (id ${event.id})`);

        const session = await getPrismaClient().$transaction(async prisma => {
            const [created] = await this.insertSessions(
                event, existing, [dto as Prisma.SessionUncheckedCreateInput], dto.allocationWeight, prisma,
            );
            return created!;
        });

        Log.info(`[Session Service]: session created (id ${session.id}) on event (id ${event.id})`);
        await this.announce(event.organizationId, [session]);
        return session;
    }

    /**
     * **Creare dal calendario**, anche in serie (`20-calendario.md` §5).
     *
     * Le occorrenze nascono in una transazione sola: metà serie non esiste. Se
     * sono lezioni di un corso, entrano nei titoli che comprendevano già tutte
     * le lezioni del corso (K3, §5.2), e la risposta dice quali: un titolo che si
     * allunga senza che nessuno lo sappia sarebbe un difetto anche con la regola
     * giusta.
     */
    public async schedule(principalId: number, dto: SessionScheduleDTO): Promise<SessionScheduleResultDTO> {
        const { recurrence, ...base } = dto;
        const event = await this.assertWritableEvent(principalId, base.eventId);
        this.assertDatesAreCoherent(base.startAt, base.endAt);

        const eventType = await this.eventTypeRepository.findOne({ id: event.eventTypeId });
        this.assertKindFitsEvent(base.kind, eventType);

        const expansion = expandWeekly(base.startAt, base.endAt, recurrence);
        if (!expansion.ok) {
            Log.warn(`[Session Service]: schedule refused on event (id ${event.id}) — recurrence ${expansion.reason}`);
            throw new httpErrors.BadRequest(expansionErrorMessage(expansion.reason));
        }
        const occurrences = expansion.occurrences;

        const existing = await this.sessionRepository.findByEvent(event.id);
        this.assertRoomForSessions(event, eventType, existing, occurrences.length);

        const seriesId = occurrences.length > 1 ? randomUUID() : null;
        const rows: Prisma.SessionUncheckedCreateInput[] = occurrences.map(occurrence => ({
            ...(base as Prisma.SessionUncheckedCreateInput),
            startAt: occurrence.startAt,
            endAt: occurrence.endAt,
            seriesId,
        }));
        const areLessons = eventType?.family === EventTypeFamily.COURSE
            && (base.kind ?? SessionKind.REGULAR) === SessionKind.REGULAR;

        Log.info(
            `[Session Service]: scheduling ${rows.length} session(s) on event (id ${event.id})`
            + (seriesId ? ` as series ${seriesId}` : ""),
        );

        const result = await getPrismaClient().$transaction(async prisma => {
            const sessions = await this.insertSessions(event, existing, rows, undefined, prisma);
            const extendedTicketTypes = areLessons
                ? await this.extendCompleteTicketTypes(event.id, existing, sessions, prisma)
                : [];
            return { sessions, extendedTicketTypes };
        });

        Log.info(
            `[Session Service]: ${result.sessions.length} session(s) scheduled on event (id ${event.id}), `
            + `${result.extendedTicketTypes.length} ticket type(s) extended`,
        );
        const first = result.sessions[0]!;
        const n = result.sessions.length;
        const what = base.kind === SessionKind.OPEN_DAY ? "Open day" : areLessons ? (n === 1 ? "Lezione" : "lezioni") : (n === 1 ? "Sessione" : "sessioni");
        await this.activityService.calendar(
            event.organizationId,
            n === 1
                ? `${what} aggiunt${what === "Open day" ? "o" : "a"} a ${titleText(event.title)}, ${whenText(first.startAt)}`
                : `${n} ${what} aggiunte a ${titleText(event.title)}, dal ${whenText(first.startAt)}`,
            event.id,
        );
        await this.announce(event.organizationId, result.sessions);
        return result;
    }

    /**
     * Le sessioni che toccano il periodo, per la griglia del calendario. Tutte
     * le famiglie: le lezioni dei corsi e le sessioni di festival e milonghe.
     */
    public async findCalendar(principalId: number, range: CalendarRangeDTO) {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.sessionRepository.findCalendarInScope(scope, range.from, range.to);
    }

    /**
     * «Questo e i successivi» o «tutti» (`20-calendario.md` §5.1). Si propagano
     * ora d'orologio, durata, nome, sala e livello — ognuna nel **suo** giorno.
     */
    public async updateSeries(principalId: number, id: number, dto: SessionSeriesUpdateDTO): Promise<Session[]> {
        const session = await this.findByIdOrThrow(principalId, id);
        const seriesId = this.assertInSeries(session);
        const event = await this.assertWritableEvent(principalId, session.eventId);

        const retiming = dto.startAt !== undefined || dto.endAt !== undefined;
        const template = { startAt: dto.startAt ?? session.startAt, endAt: dto.endAt ?? session.endAt };
        if (retiming) {
            this.assertDatesAreCoherent(template.startAt, template.endAt);
            if (!sameLocalDay(template.startAt, session.startAt)) {
                Log.warn(`[Session Service]: series update refused for session (id ${id}) — the day was moved`);
                throw new httpErrors.BadRequest(
                    "Una serie non si sposta di giorno: elimina le lezioni e ricreale nel giorno nuovo.",
                );
            }
        }

        const targets = await this.sessionRepository.findSeries(seriesId, this.seriesStart(dto.scope, session));

        Log.info(
            `[Session Service]: updating ${targets.length} session(s) of series ${seriesId} `
            + `(scope ${dto.scope}, from session id ${id})`,
        );

        const updated = await getPrismaClient().$transaction(async prisma => {
            const out: Session[] = [];
            for (const target of targets) {
                out.push(await this.sessionRepository.update(
                    { id: target.id },
                    {
                        ...(dto.name !== undefined && { name: dto.name }),
                        ...(dto.room !== undefined && { room: dto.room }),
                        ...(dto.level !== undefined && { level: dto.level }),
                        ...(retiming && retime(target.startAt, template)),
                    },
                    undefined,
                    undefined,
                    prisma,
                ));
            }
            return out;
        });

        await this.activityService.calendar(
            event.organizationId,
            `${updated.length} lezioni di ${titleText(event.title)} modificate`
                + (retiming && updated[0] ? `, ora ${whenText(updated[0].startAt).replace(/^.* alle /, "alle ")}` : ""),
            event.id,
        );
        Log.info(`[Session Service]: series ${seriesId} updated — ${updated.length} session(s)`);
        await this.announce(event.organizationId, [...targets, ...updated]);
        return updated;
    }

    /**
     * Elimina «questo e i successivi» o «tutti». **Salta** le occorrenze già
     * concluse — la storia non si riscrive — e quelle con almeno un check-in:
     * qualcuno c'era, e quella presenza resta. La risposta dice quante.
     */
    public async deleteSeries(principalId: number, id: number, scope: SeriesScope): Promise<SeriesDeletionDTO> {
        const session = await this.findByIdOrThrow(principalId, id);
        const seriesId = this.assertInSeries(session);
        const event = await this.assertWritableEvent(principalId, session.eventId);

        const targets = await this.sessionRepository.findSeries(seriesId, this.seriesStart(scope, session));
        const now = Date.now();
        const past = targets.filter(t => t.endAt.getTime() <= now);
        const withCheckIns = targets.filter(t => t.endAt.getTime() > now && t._count.checkIns > 0);
        const deletable = targets.filter(t => !past.includes(t) && !withCheckIns.includes(t) && !t.isImplicit);

        Log.info(
            `[Session Service]: deleting ${deletable.length} session(s) of series ${seriesId} (scope ${scope}) — `
            + `skipping ${past.length} past and ${withCheckIns.length} with check-ins`,
        );

        await getPrismaClient().$transaction(async prisma => {
            for (const target of deletable) {
                await this.sessionRepository.safeDeleteById(target.id, prisma);
            }
        });

        if (deletable.length) {
            await this.activityService.calendar(
                event.organizationId,
                `${deletable.length} ${deletable.length === 1 ? "lezione" : "lezioni"} di ${titleText(event.title)} eliminat${deletable.length === 1 ? "a" : "e"}`,
                event.id,
            );
        }
        await this.announce(event.organizationId, deletable);
        return { deleted: deletable.length, skippedPast: past.length, skippedWithCheckIns: withCheckIns.length };
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Session | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.sessionRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(principalId: number, query: SessionQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<Session>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.sessionRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: SessionUpdateDTO): Promise<Session> {
        const session = await this.findByIdOrThrow(principalId, id);
        const event = await this.assertWritableEvent(principalId, session.eventId);
        this.assertDatesAreCoherent(dto.startAt ?? session.startAt, dto.endAt ?? session.endAt);
        if (dto.kind !== undefined) {
            this.assertKindFitsEvent(dto.kind, await this.eventTypeRepository.findOne({ id: event.eventTypeId }));
        }

        Log.info(`[Session Service]: updating session (id ${id})`);
        const updated = await this.sessionRepository.update({ id }, dto as any);
        await this.announce(event.organizationId, [session, updated]);
        return updated;
    }

    public async safeDeleteById(principalId: number, id: number): Promise<Session> {
        const session = await this.findByIdOrThrow(principalId, id);
        const event = await this.assertWritableEvent(principalId, session.eventId);

        if (session.isImplicit) {
            Log.warn(`[Session Service]: refusing to delete the implicit session (id ${id}) of event (id ${session.eventId})`);
            throw new httpErrors.BadRequest(
                "La sessione implicita non può essere eliminata: è il contenitore su cui gira il check-in dell'evento.",
            );
        }

        Log.info(`[Session Service]: soft deleting session (id ${id})`);
        const deleted = await this.sessionRepository.safeDeleteById(id);
        await this.announce(event.organizationId, [session]);
        return deleted;
    }

    /**
     * `RF-EVT-35` — annullamento di una sessione. Restituisce **l'elenco dei
     * titoli che la includono con il loro peso**: è ciò su cui si appoggiano il
     * rimborso proporzionale (fase 1b) e la comunicazione ai soli titolari
     * interessati.
     *
     * **Rilascia le quote della sessione** e nient'altro: l'evento si svolge
     * regolarmente, le iscrizioni restano, i biglietti restano validi per tutto
     * il resto. Il rilascio è quello esatto del motore — si leggono i
     * `QuotaConsumption` di quelle quote, si decrementano quei contatori, si
     * cancellano quelle righe.
     *
     * Annullamento e rilascio stanno nella **stessa transazione**: una sessione
     * annullata che continuasse a tenere impegnati i posti è capienza persa che
     * nessuno saprebbe recuperare.
     */
    public async cancelSession(principalId: number, id: number, reason: string): Promise<SessionCancellationDTO> {
        const session = await this.findByIdOrThrow(principalId, id);
        const event = await this.assertWritableEvent(principalId, session.eventId);

        if (session.cancelledAt) {
            Log.warn(`[Session Service]: cancel refused for session (id ${id}) — already cancelled`);
            throw new httpErrors.BadRequest("La sessione è già annullata.");
        }

        const affected: TicketType[] = await this.ticketTypeRepository.findIncludingSession(id);

        Log.info(
            `[Session Service]: cancelling session (id ${id}) of event (id ${session.eventId}) — `
            + `reason: ${reason}, ${affected.length} ticket type(s) include it`,
        );

        const outcome = await getPrismaClient().$transaction(async prisma => {
            const cancelled = await this.sessionRepository.update(
                { id },
                { cancelledAt: new Date(), cancellationReason: reason },
                undefined,
                undefined,
                prisma,
            );

            const released = await this.capacityEngineService.releaseSession(session.eventId, id, prisma);

            Log.info(
                `[Session Service]: session (id ${id}) cancelled — released ${released.releasedQuantity} unit(s) `
                + `across ${released.releasedQuotaIds.length} session quota(s)`,
            );

            return {
                session: cancelled,
                affectedTicketTypes: affected.map(ticketType => ({
                    id: ticketType.id,
                    name: ticketType.name,
                    allocationWeight: session.allocationWeight,
                })),
                released,
            };
        });

        await this.activityService.calendar(
            event.organizationId,
            `«${titleText(session.name)}» di ${titleText(event.title)} annullata, ${whenText(session.startAt)}: ${reason}`,
            event.id,
        );
        await this.announce(event.organizationId, [session]);
        return outcome;
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Inserisce le sessioni e applica il peso di ripartizione (`RF-EVT-36`): il
     * default uniforme sul nuovo totale, e il riequilibrio delle esistenti **solo
     * se nessuna porta ancora un peso scelto dall'organizzatore** — i pesi
     * assegnati a mano non vengono mai sovrascritti. Una lezione sola e una
     * serie di dodici seguono la stessa regola, ed è per questo che è qui.
     */
    private async insertSessions(
        event: Event,
        existing: Session[],
        rows: Prisma.SessionUncheckedCreateInput[],
        explicitWeight: number | undefined,
        prisma: Prisma.TransactionClient,
    ): Promise<Session[]> {
        const previousUniform = uniformAllocationWeight(existing.length);
        const nextUniform = uniformAllocationWeight(existing.length + rows.length);
        const allWeightsAreServerAssigned = existing.every(s => s.allocationWeight === previousUniform);

        const created: Session[] = [];
        for (const row of rows) {
            created.push(await this.sessionRepository.save(
                { ...(row as any), allocationWeight: explicitWeight ?? nextUniform },
                prisma,
            ));
        }

        if (explicitWeight === undefined && allWeightsAreServerAssigned && previousUniform !== nextUniform) {
            for (const other of existing) {
                await this.sessionRepository.update(
                    { id: other.id },
                    { allocationWeight: nextUniform },
                    undefined,
                    undefined,
                    prisma,
                );
            }
            Log.info(
                `[Session Service]: rebalanced ${existing.length} session(s) of event (id ${event.id}) `
                + `to the uniform allocation weight ${nextUniform}`,
            );
        }
        return created;
    }

    /**
     * K3 (`20-calendario.md` §5.2) — le lezioni nuove entrano in **ogni titolo
     * che comprendeva già tutte le lezioni vive** del corso. «Trimestre intero»
     * si allunga; «Lezione singola» no. Gli open day non contano: non fanno
     * parte del trimestre, e un titolo non li deve comprendere per restare
     * «completo». Un corso senza lezioni vive non ha titoli «completi».
     */
    private async extendCompleteTicketTypes(
        eventId: number,
        existing: Session[],
        created: Session[],
        prisma: Prisma.TransactionClient,
    ): Promise<ExtendedTicketTypeDTO[]> {
        const liveLessons = existing.filter(s => s.kind === SessionKind.REGULAR && !s.cancelledAt);
        if (!liveLessons.length) {
            return [];
        }

        const ticketTypes = await this.ticketTypeRepository.findWithSessionsAndTiersByEvent(eventId, false, prisma);
        const extended: ExtendedTicketTypeDTO[] = [];
        for (const ticketType of ticketTypes) {
            const included = new Set(ticketType.sessions.map(link => link.sessionId));
            if (!liveLessons.every(lesson => included.has(lesson.id))) {
                continue;
            }
            for (const session of created) {
                await this.ticketTypeSessionRepository.save({ ticketTypeId: ticketType.id, sessionId: session.id }, prisma);
            }
            extended.push({ id: ticketType.id, name: ticketType.name, addedSessions: created.length });
            Log.info(
                `[Session Service]: ticket type (id ${ticketType.id}) covered every lesson — `
                + `extended with ${created.length} new session(s)`,
            );
        }
        return extended;
    }

    /** L'open day esiste solo sui corsi (`19-prospect.md`): un festival non ne ha. */
    private assertKindFitsEvent(kind: SessionKind | undefined, eventType: EventType | null): void {
        if (kind === SessionKind.OPEN_DAY && eventType?.family !== EventTypeFamily.COURSE) {
            Log.warn(`[Session Service]: refusing an open day on a non-course event type (id ${eventType?.id})`);
            throw new httpErrors.BadRequest("L'open day esiste solo sui corsi.");
        }
    }

    private assertRoomForSessions(event: Event, eventType: EventType | null, existing: Session[], adding: number): void {
        if (eventType && !eventType.capMultiSession && existing.length + adding > 1) {
            Log.warn(
                `[Session Service]: refusing ${adding} more session(s) on event (id ${event.id}) — `
                + `event type '${eventType.slug}' has capMultiSession = false`,
            );
            throw new httpErrors.BadRequest("Il tipo di evento non prevede più di una sessione.");
        }
    }

    private assertInSeries(session: Session): string {
        if (!session.seriesId) {
            Log.warn(`[Session Service]: session (id ${session.id}) is not part of a series`);
            throw new httpErrors.BadRequest("Questa sessione non fa parte di una serie.");
        }
        return session.seriesId;
    }

    /** «Tutti» parte dalla prima occorrenza; «questo e i successivi» da questa. */
    private seriesStart(scope: SeriesScope, session: Session): Date | undefined {
        return scope === "FOLLOWING" ? session.startAt : undefined;
    }

    private async announce(organizationId: number, sessions: { startAt: Date; endAt: Date }[]): Promise<void> {
        await this.calendarBroadcastService.publishChanged(organizationId, "SESSION", sessions);
    }

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[Session Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<Session> {
        const session = await this.findById(principalId, id);
        if (!session) {
            Log.warn(`[Session Service]: session (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Sessione non trovata.");
        }
        return session;
    }

    private assertDatesAreCoherent(startAt: Date, endAt: Date): void {
        if (endAt.getTime() < startAt.getTime()) {
            Log.warn(`[Session Service]: incoherent session dates — endAt precedes startAt`);
            throw new httpErrors.BadRequest("La data di fine della sessione non può precedere quella di inizio.");
        }
    }

    private createQueryFromPayload(payload: SessionQueryDTO): Prisma.SessionWhereInput {
        const query: Prisma.SessionWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(!payload.includeCancelled, { cancelledAt: null }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
