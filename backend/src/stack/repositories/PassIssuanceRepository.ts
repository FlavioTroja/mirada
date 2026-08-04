import { Service } from "fastify-decorators";
import { PassIssuance, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class PassIssuanceRepository extends BaseRepository<"passIssuance"> {
    constructor() {
        super("passIssuance");
    }

    async findByEvent(eventId: number, tx?: Prisma.TransactionClient): Promise<PassIssuance[]> {
        return this.findMany({ eventId, deleted: false }, { orderBy: { id: "asc" } }, tx);
    }

    /** Pass emessi e non revocati per un evento — ciò che il cruscotto somma alle vendite. */
    async sumActiveQuantityByEvent(eventId: number, tx?: Prisma.TransactionClient): Promise<number> {
        const rows = await this.findMany(
            { eventId, deleted: false, revokedAt: null },
            { orderBy: { id: "asc" } },
            tx,
        );
        return rows.reduce((total, row) => total + row.quantity, 0);
    }

    /** §1.5 — lo scope passa dall'evento. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.PassIssuanceWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PassIssuance | null> {
        return this.findOne({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.PassIssuanceWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<PassIssuance>> {
        return this.paginate({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<PassIssuance> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
