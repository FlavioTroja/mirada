import { Service } from "fastify-decorators";
import { Prisma, TicketTransfer } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope } from "@utils/helpers/organizationScope";

/**
 * Storico dei passaggi di titolarità — **sola lettura via API** (§3.4): le righe
 * nascono soltanto dentro la transazione di `POST /tickets/:id/transfer`.
 */
@Service()
export class TicketTransferRepository extends BaseRepository<"ticketTransfer"> {
    constructor() {
        super("ticketTransfer");
    }

    async findByTicket(ticketId: number, tx?: Prisma.TransactionClient): Promise<TicketTransfer[]> {
        return this.findMany({ ticketId, deleted: false }, { orderBy: { transferredAt: "asc" } }, tx);
    }

    /** §1.5 — lo scope passa dal biglietto e poi dall'evento. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.TicketTransferWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<TicketTransfer | null> {
        return this.findOne({ AND: [query, this.scopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.TicketTransferWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<TicketTransfer>> {
        return this.paginate({ AND: [query, this.scopeWhere(scope)] }, options, tx);
    }

    private scopeWhere(scope: OrganizationScope): Prisma.TicketTransferWhereInput {
        return scope === null ? {} : { ticket: { event: { organizationId: { in: scope } } } };
    }
}
