import { Service } from "fastify-decorators";
import { OrderLine, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";

/**
 * `OrderLine` — **figlio posseduto** (§2, §3.4): `onDelete: Cascade` da `Order`
 * e **nessun controller proprio**. Si modifica con l'unico `PATCH
 * /orders/:id/lines` che porta l'array intero.
 */
@Service()
export class OrderLineRepository extends BaseRepository<"orderLine"> {
    constructor() {
        super("orderLine");
    }

    async findByOrder(orderId: number, tx?: Prisma.TransactionClient): Promise<OrderLine[]> {
        return this.findMany({ orderId }, { orderBy: { id: "asc" } }, tx);
    }

    async findByOrders(orderIds: number[], tx?: Prisma.TransactionClient): Promise<OrderLine[]> {
        if (!orderIds.length) {
            return [];
        }
        return this.findMany({ orderId: { in: orderIds } }, { orderBy: { id: "asc" } }, tx);
    }

    /**
     * Cancellazione **reale**: la riga d'ordine non ha colonna `deleted` ed è un
     * figlio posseduto. È ciò che `POST /orders/:id/confirm-partial` fa alle
     * righe indisponibili — che non devono restare a fingere un servizio che
     * l'utente non ha comprato e non pagherà (`RB17`).
     */
    async deleteByIds(ids: number[], tx?: Prisma.TransactionClient): Promise<number> {
        if (!ids.length) {
            return 0;
        }
        const result = await this.exec(() =>
            (this.getDelegate(tx) as Prisma.OrderLineDelegate).deleteMany({ where: { id: { in: ids } } }),
        );
        return result.count;
    }
}
