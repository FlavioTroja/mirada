import { Service } from "fastify-decorators";
import { EventType, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { isBoolean } from "lodash";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { EventTypeRepository } from "@repositories/EventTypeRepository";
import { EventTypeCreateDTO } from "@DTOs/event_type/EventTypeCreateDTO";
import { EventTypeUpdateDTO } from "@DTOs/event_type/EventTypeUpdateDTO";
import { EventTypeQueryDTO } from "@DTOs/event_type/EventTypeQueryDTO";

@Service()
export class EventTypeService {
    constructor(private readonly eventTypeRepository: EventTypeRepository) {}

    public async save(dto: EventTypeCreateDTO): Promise<EventType> {
        Log.info(`[EventType Service]: creating event type '${dto.slug}'`);

        const existing = await this.eventTypeRepository.findBySlug(dto.slug);
        if (existing) {
            Log.warn(`[EventType Service]: slug '${dto.slug}' already in use (id ${existing.id})`);
            throw new httpErrors.BadRequest("Esiste già un tipo di evento con questo slug.");
        }

        const eventType = await this.eventTypeRepository.save(this.toPrismaData(dto));
        Log.info(`[EventType Service]: event type created '${eventType.slug}' (id ${eventType.id})`);
        return eventType;
    }

    public async findById(id: number, options?: FindOptions): Promise<EventType | null> {
        return this.eventTypeRepository.findOne({ id, deleted: false }, options);
    }

    public async findBySlug(slug: string): Promise<EventType | null> {
        return this.eventTypeRepository.findBySlug(slug);
    }

    public async findAllActive(): Promise<EventType[]> {
        return this.eventTypeRepository.findAllActive();
    }

    public async paginate(query: EventTypeQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<EventType>> {
        return this.eventTypeRepository.paginate(this.createQueryFromPayload(query), options);
    }

    public async updateById(id: number, dto: EventTypeUpdateDTO): Promise<EventType> {
        Log.info(`[EventType Service]: updating event type (id ${id})`);
        return this.eventTypeRepository.update({ id }, this.toPrismaData(dto));
    }

    public async safeDeleteById(id: number): Promise<EventType> {
        Log.info(`[EventType Service]: soft deleting event type (id ${id})`);
        return this.eventTypeRepository.safeDeleteById(id);
    }

    /**
     * `sessionsLabel` è un `Json` nullable: Prisma vuole `Prisma.DbNull` per
     * azzerarlo, non `null`. La conversione sta qui perché il DTO deve restare il
     * contratto del §3.6 — stessa forma di `ArtistService.toPrismaData` per `bio`.
     *
     * Azzerarlo significa «questo tipo chiama le sue sessioni come tutti gli
     * altri», ed è un'operazione legittima: non si può quindi trattare il `null`
     * come «campo non inviato».
     */
    private toPrismaData<T extends { sessionsLabel?: unknown }>(dto: T) {
        return {
            ...dto,
            ...(dto.sessionsLabel === null ? { sessionsLabel: Prisma.DbNull } : {}),
        } as T & { sessionsLabel?: never };
    }

    private createQueryFromPayload(payload: EventTypeQueryDTO): Prisma.EventTypeWhereInput {
        const valueQuery: Prisma.EventTypeWhereInput[] = [
            createObjectWithoutThrow(payload.value, { slug: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.EventTypeWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(isBoolean(payload.active), { active: payload.active }),
            createObjectWithoutThrow(payload.slug, { slug: payload.slug }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
