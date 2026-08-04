import { Service } from "fastify-decorators";
import { Event, EventCast, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { EventCastRepository } from "@repositories/EventCastRepository";
import { EventRepository } from "@repositories/EventRepository";
import { ArtistRepository } from "@repositories/ArtistRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { EventCastCreateDTO } from "@DTOs/event_cast/EventCastCreateDTO";
import { EventCastUpdateDTO } from "@DTOs/event_cast/EventCastUpdateDTO";
import { EventCastQueryDTO } from "@DTOs/event_cast/EventCastQueryDTO";

/** Join con significato proprio: porta `kind` e `sortOrder` (§4.6). */
@Service()
export class EventCastService {
    constructor(
        private readonly eventCastRepository: EventCastRepository,
        private readonly eventRepository: EventRepository,
        private readonly artistRepository: ArtistRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async save(principalId: number, dto: EventCastCreateDTO): Promise<EventCast> {
        await this.assertWritableEvent(principalId, dto.eventId);

        const artist = await this.artistRepository.findOne({ id: dto.artistId, deleted: false });
        if (!artist) {
            Log.warn(`[EventCast Service]: artist (id ${dto.artistId}) not found`);
            throw new httpErrors.BadRequest("Artista non trovato.");
        }

        Log.info(`[EventCast Service]: adding artist (id ${dto.artistId}) to the cast of event (id ${dto.eventId})`);
        const cast = await this.eventCastRepository.save(dto);
        Log.info(`[EventCast Service]: cast entry created (id ${cast.id})`);
        return cast;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<EventCast | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.eventCastRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(principalId: number, query: EventCastQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<EventCast>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.eventCastRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: EventCastUpdateDTO): Promise<EventCast> {
        const cast = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, cast.eventId);

        Log.info(`[EventCast Service]: updating cast entry (id ${id})`);
        return this.eventCastRepository.update({ id }, dto);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<EventCast> {
        const cast = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, cast.eventId);

        Log.info(`[EventCast Service]: soft deleting cast entry (id ${id})`);
        return this.eventCastRepository.safeDeleteById(id);
    }

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[EventCast Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<EventCast> {
        const cast = await this.findById(principalId, id);
        if (!cast) {
            Log.warn(`[EventCast Service]: cast entry (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Voce di cast non trovata.");
        }
        return cast;
    }

    private createQueryFromPayload(payload: EventCastQueryDTO): Prisma.EventCastWhereInput {
        const query: Prisma.EventCastWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.artistId, { artistId: payload.artistId }),
            createObjectWithoutThrow(payload.kind, { kind: payload.kind }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
