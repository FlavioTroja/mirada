import { Service } from "fastify-decorators";
import { Prisma, Venue } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, organizationOrPlatformScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class VenueRepository extends BaseRepository<"venue"> {
    constructor() {
        super("venue");
    }

    async findByOrganization(organizationId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Venue[]> {
        return this.findMany({ organizationId, deleted: false }, options, tx);
    }

    /** §1.5 — lo scope di tenancy è obbligatorio e precede la query di dominio. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.VenueWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Venue | null> {
        return this.findOne({ AND: [query, organizationOrPlatformScopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.VenueWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Venue>> {
        return this.paginate({ AND: [query, organizationOrPlatformScopeWhere(scope)] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Venue> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
