import { Service } from "fastify-decorators";
import { Artist, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, organizationOrPlatformScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class ArtistRepository extends BaseRepository<"artist"> {
    constructor() {
        super("artist");
    }

    async findByOrganization(organizationId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Artist[]> {
        return this.findMany({ organizationId, deleted: false }, options, tx);
    }

    /** §1.5 — lo scope di tenancy è obbligatorio e precede la query di dominio. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.ArtistWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Artist | null> {
        return this.findOne({ AND: [query, organizationOrPlatformScopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.ArtistWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Artist>> {
        return this.paginate({ AND: [query, organizationOrPlatformScopeWhere(scope)] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Artist> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
