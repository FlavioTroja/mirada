import { Service } from "fastify-decorators";
import { Event, Prisma, Session, TicketType } from "@prisma/client";
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
        const existing = await this.sessionRepository.findByEvent(event.id);

        if (eventType && !eventType.capMultiSession && existing.length > 0) {
            Log.warn(
                `[Session Service]: refusing a second session on event (id ${event.id}) — `
                + `event type '${eventType.slug}' has capMultiSession = false`,
            );
            throw new httpErrors.BadRequest("Il tipo di evento non prevede più di una sessione.");
        }

        const total = existing.length + 1;
        const previousUniform = uniformAllocationWeight(existing.length);
        const nextUniform = uniformAllocationWeight(total);
        const allWeightsAreServerAssigned = existing.every(s => s.allocationWeight === previousUniform);

        Log.info(`[Session Service]: creating session on event (id ${event.id})`);

        return getPrismaClient().$transaction(async prisma => {
            const session = await this.sessionRepository.save(
                {
                    ...(dto as any),
                    allocationWeight: dto.allocationWeight ?? nextUniform,
                },
                prisma,
            );

            if (dto.allocationWeight === undefined && allWeightsAreServerAssigned && previousUniform !== nextUniform) {
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

            Log.info(`[Session Service]: session created (id ${session.id}) on event (id ${event.id})`);
            return session;
        });
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
        await this.assertWritableEvent(principalId, session.eventId);
        this.assertDatesAreCoherent(dto.startAt ?? session.startAt, dto.endAt ?? session.endAt);

        Log.info(`[Session Service]: updating session (id ${id})`);
        return this.sessionRepository.update({ id }, dto as any);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<Session> {
        const session = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, session.eventId);

        if (session.isImplicit) {
            Log.warn(`[Session Service]: refusing to delete the implicit session (id ${id}) of event (id ${session.eventId})`);
            throw new httpErrors.BadRequest(
                "La sessione implicita non può essere eliminata: è il contenitore su cui gira il check-in dell'evento.",
            );
        }

        Log.info(`[Session Service]: soft deleting session (id ${id})`);
        return this.sessionRepository.safeDeleteById(id);
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
        await this.assertWritableEvent(principalId, session.eventId);

        if (session.cancelledAt) {
            Log.warn(`[Session Service]: cancel refused for session (id ${id}) — already cancelled`);
            throw new httpErrors.BadRequest("La sessione è già annullata.");
        }

        const affected: TicketType[] = await this.ticketTypeRepository.findIncludingSession(id);

        Log.info(
            `[Session Service]: cancelling session (id ${id}) of event (id ${session.eventId}) — `
            + `reason: ${reason}, ${affected.length} ticket type(s) include it`,
        );

        return getPrismaClient().$transaction(async prisma => {
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
    }

    // ─────────────────────────────────────────────────────────────────────────

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
