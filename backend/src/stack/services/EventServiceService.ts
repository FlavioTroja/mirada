import { Service } from "fastify-decorators";
import { Event, EventService as EventServiceModel, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { EventServiceRepository } from "@repositories/EventServiceRepository";
import { EventRepository } from "@repositories/EventRepository";
import { ServiceTypeRepository } from "@repositories/ServiceTypeRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { EventServiceCreateDTO } from "@DTOs/event_service/EventServiceCreateDTO";
import { EventServiceUpdateDTO } from "@DTOs/event_service/EventServiceUpdateDTO";
import { EventServiceQueryDTO } from "@DTOs/event_service/EventServiceQueryDTO";

/**
 * Servizi accessori dell'evento — l'entità `EventService` del §3.6.
 *
 * NOTA DI NOMENCLATURA — l'entità di dominio si chiama `EventService`, e
 * `naming.md` vuole `<Entità>Service` come nome della classe di servizio: da qui
 * `EventServiceService`. `@services/EventService` è invece il servizio
 * dell'entità `Event`. La collisione è del dominio, non del codice.
 *
 * `attributesConfig` dichiara quali attributi si raccolgono all'acquisto (taglia,
 * dieta, slot orario). **Diete e allergie sono l'unico dato riconducibile alla
 * salute che resta in piattaforma**: accesso ristretto, mai nelle esportazioni
 * generiche né nella vista di check-in (§4.6).
 */
@Service()
export class EventServiceService {
    constructor(
        private readonly eventServiceRepository: EventServiceRepository,
        private readonly eventRepository: EventRepository,
        private readonly serviceTypeRepository: ServiceTypeRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async save(principalId: number, dto: EventServiceCreateDTO): Promise<EventServiceModel> {
        await this.assertWritableEvent(principalId, dto.eventId);

        const serviceType = await this.serviceTypeRepository.findOne({ id: dto.serviceTypeId, deleted: false });
        if (!serviceType) {
            Log.warn(`[EventService Service]: service type (id ${dto.serviceTypeId}) not found`);
            throw new httpErrors.BadRequest("Tipo di servizio non trovato.");
        }

        this.assertPriceIsValid(dto.price);

        Log.info(`[EventService Service]: creating accessory service on event (id ${dto.eventId})`);
        const service = await this.eventServiceRepository.save(dto as any);
        Log.info(`[EventService Service]: accessory service created (id ${service.id})`);
        return service;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<EventServiceModel | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.eventServiceRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: EventServiceQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<EventServiceModel>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.eventServiceRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: EventServiceUpdateDTO): Promise<EventServiceModel> {
        const service = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, service.eventId);

        if (dto.price !== undefined) {
            this.assertPriceIsValid(dto.price);
        }

        Log.info(`[EventService Service]: updating accessory service (id ${id})`);
        return this.eventServiceRepository.update({ id }, dto as any);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<EventServiceModel> {
        const service = await this.findByIdOrThrow(principalId, id);
        await this.assertWritableEvent(principalId, service.eventId);

        Log.info(`[EventService Service]: soft deleting accessory service (id ${id})`);
        return this.eventServiceRepository.safeDeleteById(id);
    }

    /** Importi in centesimi interi, mai in virgola mobile (§3.1). */
    private assertPriceIsValid(price?: number | null): void {
        if (price === undefined || price === null) {
            return;
        }
        if (!Number.isInteger(price) || price < 0) {
            Log.warn(`[EventService Service]: invalid price ${price} — prices are non-negative integer cents`);
            throw new httpErrors.BadRequest("Il prezzo deve essere un importo in centesimi interi non negativo.");
        }
    }

    private async assertWritableEvent(principalId: number, eventId: number): Promise<Event> {
        const scope = await this.organizationScopeService.resolve(principalId);
        const event = await this.eventRepository.findOneInScope(scope, { id: eventId, deleted: false });
        if (!event) {
            Log.warn(`[EventService Service]: event (id ${eventId}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Evento non trovato.");
        }
        this.organizationScopeService.assertWritable(scope, event.organizationId);
        return event;
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<EventServiceModel> {
        const service = await this.findById(principalId, id);
        if (!service) {
            Log.warn(`[EventService Service]: accessory service (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Servizio accessorio non trovato.");
        }
        return service;
    }

    private createQueryFromPayload(payload: EventServiceQueryDTO): Prisma.EventServiceWhereInput {
        const query: Prisma.EventServiceWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.serviceTypeId, { serviceTypeId: payload.serviceTypeId }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
