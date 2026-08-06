import { Service } from "fastify-decorators";
import { Order, OrderStatus, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope } from "@utils/helpers/organizationScope";

/** L'ordine con tutto ciò che serve a decidere, in una query sola. */
export type OrderWithContext = Prisma.OrderGetPayload<{
    include: {
        lines: true;
        purchase: true;
        organization: true;
        event: true;
        reservations: true;
        payments: true;
    };
}>;

/** Stati in cui un ordine è ancora **vivo**: impegna capienza e attende un esito. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = [OrderStatus.PENDING_PAYMENT];

@Service()
export class OrderRepository extends BaseRepository<"order"> {
    constructor() {
        super("order");
    }

    async findWithContext(id: number, tx?: Prisma.TransactionClient): Promise<OrderWithContext | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({
                where: { id, deleted: false },
                include: {
                    lines: { orderBy: { id: "asc" } },
                    purchase: true,
                    organization: true,
                    event: true,
                    reservations: { orderBy: { id: "asc" } },
                    payments: { orderBy: { id: "asc" } },
                },
            }),
        ) as Promise<OrderWithContext | null>;
    }

    async findByPurchase(purchaseId: number, tx?: Prisma.TransactionClient): Promise<Order[]> {
        return this.findMany({ purchaseId, deleted: false }, { orderBy: { id: "asc" } }, tx);
    }

    /**
     * Gli ordini **saldati** di un evento: la sorgente del venduto e
     * dell'incassato nel cruscotto (`RB21`).
     *
     * Solo `PAID`, e la ragione è la distinzione che l'intero cruscotto tiene in
     * piedi: un ordine `PENDING_PAYMENT` ha già **impegnato** capienza — i posti
     * sono sottratti a tutti gli altri — ma non ha venduto nulla, e alla scadenza
     * dei quindici minuti torna indietro. Contarlo fra i ricavi significherebbe
     * annunciare un incasso che il tempo può cancellare.
     */
    async findPaidByEvent(eventId: number, tx?: Prisma.TransactionClient): Promise<Order[]> {
        return this.findMany(
            { eventId, deleted: false, status: OrderStatus.PAID },
            { orderBy: { id: "asc" } },
            tx,
        );
    }

    /**
     * §1.5 su un'entità a due proprietari (come `Purchase`): l'ordine è **al
     * tempo stesso** una riga del compratore e una riga dell'organizzazione che
     * incassa. Il `DANCER` vede i propri ordini, lo staff quelli della propria
     * organizzazione, e **nessuno dei due vede quelli di un terzo** — nemmeno un
     * conteggio aggregato (§1.5).
     */
    static visibilityWhere(scope: OrganizationScope, buyerUserId: number): Prisma.OrderWhereInput {
        if (scope === null) {
            return {};
        }
        if (!scope.length) {
            return { purchase: { buyerUserId } };
        }
        return {
            OR: [
                { purchase: { buyerUserId } },
                { organizationId: { in: scope } },
            ],
        };
    }

    async findOneVisible(
        scope: OrganizationScope,
        buyerUserId: number,
        query: Prisma.OrderWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Order | null> {
        return this.findOne({ AND: [query, OrderRepository.visibilityWhere(scope, buyerUserId)] }, options, tx);
    }

    async paginateVisible(
        scope: OrganizationScope,
        buyerUserId: number,
        query: Prisma.OrderWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Order>> {
        return this.paginate({ AND: [query, OrderRepository.visibilityWhere(scope, buyerUserId)] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Order> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } }),
        );
    }
}
