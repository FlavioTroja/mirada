import { Service } from "fastify-decorators";
import { Artist, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { ArtistRepository } from "@repositories/ArtistRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { ArtistCreateDTO } from "@DTOs/artist/ArtistCreateDTO";
import { ArtistUpdateDTO } from "@DTOs/artist/ArtistUpdateDTO";
import { ArtistQueryDTO } from "@DTOs/artist/ArtistQueryDTO";

@Service()
export class ArtistService {
    constructor(
        private readonly artistRepository: ArtistRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async save(principalId: number, dto: ArtistCreateDTO): Promise<Artist> {
        const scope = await this.organizationScopeService.resolve(principalId);
        // L'organizzazione la DERIVA il server: il client non deve dichiarare la
        // propria, e non deve poter dichiarare quella di altri.
        const organizationId = this.organizationScopeService.resolveOwner(scope, dto.organizationId);

        Log.info(`[Artist Service]: creating artist '${dto.name}' (${dto.kind})`);
        const artist = await this.artistRepository.save(this.toPrismaData({ ...dto, organizationId }));
        Log.info(`[Artist Service]: artist created '${artist.name}' (id ${artist.id})`);
        return artist;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Artist | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.artistRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(principalId: number, query: ArtistQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<Artist>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.artistRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: ArtistUpdateDTO): Promise<Artist> {
        const artist = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, dto.organizationId ?? artist.organizationId);

        Log.info(`[Artist Service]: updating artist (id ${id})`);
        return this.artistRepository.update({ id }, this.toPrismaData(dto));
    }

    public async safeDeleteById(principalId: number, id: number): Promise<Artist> {
        const artist = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, artist.organizationId);

        Log.info(`[Artist Service]: soft deleting artist (id ${id})`);
        return this.artistRepository.safeDeleteById(id);
    }

    /**
     * `bio` è un `Json` nullable: Prisma vuole `Prisma.DbNull` per azzerarlo, non
     * `null`. La conversione sta qui perché il DTO deve restare il contratto del §3.6.
     */
    private toPrismaData<T extends { bio?: unknown }>(dto: T) {
        return { ...dto, ...(dto.bio === null ? { bio: Prisma.DbNull } : {}) } as T & { bio?: never };
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<Artist> {
        const artist = await this.findById(principalId, id);
        if (!artist) {
            Log.warn(`[Artist Service]: artist (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Artista non trovato.");
        }
        return artist;
    }

    private createQueryFromPayload(payload: ArtistQueryDTO): Prisma.ArtistWhereInput {
        const valueQuery: Prisma.ArtistWhereInput[] = [
            createObjectWithoutThrow(payload.value, { name: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { website: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.ArtistWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(payload.organizationId, { organizationId: payload.organizationId }),
            createObjectWithoutThrow(payload.kind?.length, { kind: { in: payload.kind } }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
