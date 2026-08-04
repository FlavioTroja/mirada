import { Service } from "fastify-decorators";
import { Prisma, Session } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class SessionRepository extends BaseRepository<"session"> {
    constructor() {
        super("session");
    }

    async findByEvent(eventId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Session[]> {
        return this.findMany({ eventId, deleted: false }, { ...options, orderBy: [{ sortOrder: "asc" }, { startAt: "asc" }] }, tx);
    }

    async countByEvent(eventId: number, tx?: Prisma.TransactionClient): Promise<number> {
        return this.count({ eventId, deleted: false }, tx);
    }

    /** §1.5 — la sessione non porta `organizationId`: lo scope passa dall'evento. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.SessionWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Session | null> {
        return this.findOne({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.SessionWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Session>> {
        return this.paginate({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Session> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
