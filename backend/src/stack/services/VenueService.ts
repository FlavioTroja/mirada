import { Service } from "fastify-decorators";
import { Prisma, Venue } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { VenueRepository } from "@repositories/VenueRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { VenueCreateDTO } from "@DTOs/venue/VenueCreateDTO";
import { VenueUpdateDTO } from "@DTOs/venue/VenueUpdateDTO";
import { VenueQueryDTO } from "@DTOs/venue/VenueQueryDTO";

@Service()
export class VenueService {
    constructor(
        private readonly venueRepository: VenueRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async save(principalId: number, dto: VenueCreateDTO): Promise<Venue> {
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, dto.organizationId);

        Log.info(`[Venue Service]: creating venue '${dto.name}' for organization (id ${dto.organizationId ?? "platform"})`);
        const venue = await this.venueRepository.save(dto);
        Log.info(`[Venue Service]: venue created '${venue.name}' (id ${venue.id})`);
        return venue;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Venue | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.venueRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(principalId: number, query: VenueQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<Venue>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.venueRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: VenueUpdateDTO): Promise<Venue> {
        const venue = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, dto.organizationId ?? venue.organizationId);

        Log.info(`[Venue Service]: updating venue (id ${id})`);
        return this.venueRepository.update({ id }, dto);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<Venue> {
        const venue = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, venue.organizationId);

        Log.info(`[Venue Service]: soft deleting venue (id ${id})`);
        return this.venueRepository.safeDeleteById(id);
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<Venue> {
        const venue = await this.findById(principalId, id);
        if (!venue) {
            Log.warn(`[Venue Service]: venue (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Sala non trovata.");
        }
        return venue;
    }

    private createQueryFromPayload(payload: VenueQueryDTO): Prisma.VenueWhereInput {
        const valueQuery: Prisma.VenueWhereInput[] = [
            createObjectWithoutThrow(payload.value, { name: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { notes: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { floorNotes: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.VenueWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(payload.organizationId, { organizationId: payload.organizationId }),
            createObjectWithoutThrow(payload.accessibleOnly, { accessibility: { not: null } }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
