import { Service } from "fastify-decorators";
import { EventRequirement, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class EventRequirementRepository extends BaseRepository<"eventRequirement"> {
    constructor() {
        super("eventRequirement");
    }

    async findByEvent(eventId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<EventRequirement[]> {
        return this.findMany({ eventId, deleted: false }, { ...options, orderBy: { sortOrder: "asc" } }, tx);
    }

    /** §1.5 — lo scope passa dall'evento. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.EventRequirementWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<EventRequirement | null> {
        return this.findOne({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.EventRequirementWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<EventRequirement>> {
        return this.paginate({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<EventRequirement> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
