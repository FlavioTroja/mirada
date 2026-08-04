import { Service } from "fastify-decorators";
import { Couple, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/**
 * La coppia **non punta alle iscrizioni**: sono le `Registration` a puntare a lei
 * con `coupleId`, così il grafo resta aciclico (§3.6). Ogni finder che vuole i
 * due componenti passa quindi da `RegistrationRepository.findByCouple`.
 */
@Service()
export class CoupleRepository extends BaseRepository<"couple"> {
    constructor() {
        super("couple");
    }

    async findByEvent(eventId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Couple[]> {
        return this.findMany({ eventId, deleted: false }, { ...options, orderBy: { id: "asc" } }, tx);
    }

    /** §1.5 — lo scope passa dall'evento. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.CoupleWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Couple | null> {
        return this.findOne({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.CoupleWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Couple>> {
        return this.paginate({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Couple> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
