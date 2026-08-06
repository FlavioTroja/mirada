import { Service } from "fastify-decorators";
import { Payment, PaymentStatus, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope } from "@utils/helpers/organizationScope";

/**
 * `Payment` — backend-brief §4.11. **Sola lettura via API** (§3.4).
 *
 * `idempotencyKey` è unico ed è la difesa contro la doppia registrazione: la
 * chiave si costruisce **dall'ordine**, non da un contatore, così due tentativi
 * di chiudere lo stesso ordine producono un conflitto di chiave invece di due
 * pagamenti. È la stessa proprietà che il webhook della fase D2 userà su
 * `event.id` di Stripe (`RF-PAY-10`).
 */
@Service()
export class PaymentRepository extends BaseRepository<"payment"> {
    constructor() {
        super("payment");
    }

    async findByOrder(orderId: number, tx?: Prisma.TransactionClient): Promise<Payment[]> {
        return this.findMany({ orderId, deleted: false }, { orderBy: { id: "asc" } }, tx);
    }

    /**
     * Gli incassi **riusciti** su un insieme di ordini.
     *
     * Solo `SUCCEEDED`: un `PENDING` è un tentativo in volo e un `FAILED` è un
     * incasso che non c'è stato — sommarli darebbe un totale che nessun conto
     * corrente rispecchia. `REFUNDED` e `PARTIALLY_REFUNDED` restano fuori
     * finché `Refund` non esiste: senza gli importi rimborsati non si sa quanto
     * di quel pagamento sia ancora in casa, e un numero a metà è peggio di un
     * numero assente.
     */
    async findSucceededByOrders(orderIds: number[], tx?: Prisma.TransactionClient): Promise<Payment[]> {
        if (!orderIds.length) {
            return [];
        }
        return this.findMany(
            { orderId: { in: orderIds }, deleted: false, status: PaymentStatus.SUCCEEDED },
            { orderBy: { id: "asc" } },
            tx,
        );
    }

    async findByIdempotencyKey(idempotencyKey: string, tx?: Prisma.TransactionClient): Promise<Payment | null> {
        return this.findOne({ idempotencyKey }, undefined, tx);
    }

    /** §1.5 — l'`OWNER` vede gli incassi della propria organizzazione, il `DANCER` i propri. */
    static visibilityWhere(scope: OrganizationScope, buyerUserId: number): Prisma.PaymentWhereInput {
        if (scope === null) {
            return {};
        }
        if (!scope.length) {
            return { order: { purchase: { buyerUserId } } };
        }
        return {
            OR: [
                { order: { purchase: { buyerUserId } } },
                { order: { organizationId: { in: scope } } },
            ],
        };
    }

    async findOneVisible(
        scope: OrganizationScope,
        buyerUserId: number,
        query: Prisma.PaymentWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Payment | null> {
        return this.findOne({ AND: [query, PaymentRepository.visibilityWhere(scope, buyerUserId)] }, options, tx);
    }

    async paginateVisible(
        scope: OrganizationScope,
        buyerUserId: number,
        query: Prisma.PaymentWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Payment>> {
        return this.paginate({ AND: [query, PaymentRepository.visibilityWhere(scope, buyerUserId)] }, options, tx);
    }
}
