import { Service } from "fastify-decorators";
import { Prisma, SalesChannelDepositCode } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions } from "@utils/helpers/exz";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/**
 * I codici sconto che, sul negozio, significano «acconto» — `14` §3.1.
 *
 * Come per le mappature, lo scope del §1.5 passa dal canale: è l'unico a portare
 * `organizationId`.
 */
@Service()
export class SalesChannelDepositCodeRepository extends BaseRepository<"salesChannelDepositCode"> {
    constructor() {
        super("salesChannelDepositCode");
    }

    async findByChannel(salesChannelId: number, tx?: Prisma.TransactionClient): Promise<SalesChannelDepositCode[]> {
        return this.findMany({ salesChannelId, deleted: false }, { orderBy: { id: "asc" } }, tx);
    }

    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.SalesChannelDepositCodeWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<SalesChannelDepositCode | null> {
        return this.findOne(
            { AND: [query, relationOrganizationScopeWhere(scope, "salesChannel")] },
            options,
            tx,
        );
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<SalesChannelDepositCode> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
