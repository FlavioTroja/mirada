import { Service } from "fastify-decorators";
import { Prisma, Purchase } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope } from "@utils/helpers/organizationScope";

/**
 * `Purchase` — backend-brief §4.11. Raggruppa N `Order`, **uno per
 * organizzatore** (`RF-PAY-34`): è il livello a cui il partecipante vede «il mio
 * acquisto», mentre l'organizzatore vede il proprio ordine e nient'altro.
 */
@Service()
export class PurchaseRepository extends BaseRepository<"purchase"> {
    constructor() {
        super("purchase");
    }

    async findWithOrders(id: number, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({
                where: { id, deleted: false },
                include: {
                    orders: {
                        where: { deleted: false },
                        include: { lines: true },
                        orderBy: { id: "asc" },
                    },
                },
            }),
        );
    }

    /**
     * §1.5 su un'entità **a due proprietari**. `Purchase` non porta
     * `organizationId` — è il carrello del compratore, non una riga
     * dell'organizzatore — quindi il filtro di tenancy ha due rami:
     *  - il `DANCER` vede **i propri** acquisti (`buyerUserId`);
     *  - lo staff vede gli acquisti che **contengono un ordine** della propria
     *    organizzazione, e nulla di ciò che riguarda le altre.
     *
     * `GOD` (scope `null`) non è filtrato.
     */
    static visibilityWhere(scope: OrganizationScope, buyerUserId: number): Prisma.PurchaseWhereInput {
        if (scope === null) {
            return {};
        }
        if (!scope.length) {
            return { buyerUserId };
        }
        return {
            OR: [
                { buyerUserId },
                { orders: { some: { organizationId: { in: scope }, deleted: false } } },
            ],
        };
    }

    async findOneVisible(
        scope: OrganizationScope,
        buyerUserId: number,
        query: Prisma.PurchaseWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Purchase | null> {
        return this.findOne(
            { AND: [query, PurchaseRepository.visibilityWhere(scope, buyerUserId)] },
            options,
            tx,
        );
    }

    async paginateVisible(
        scope: OrganizationScope,
        buyerUserId: number,
        query: Prisma.PurchaseWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Purchase>> {
        return this.paginate(
            { AND: [query, PurchaseRepository.visibilityWhere(scope, buyerUserId)] },
            options,
            tx,
        );
    }
}
