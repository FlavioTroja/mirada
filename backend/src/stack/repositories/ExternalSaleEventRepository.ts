import { Service } from "fastify-decorators";
import { ExternalSaleEvent, ExternalSaleEventStatus, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/**
 * Il registro grezzo delle notifiche ricevute da un negozio esterno — fase E.
 *
 * Sola scrittura di sistema: nessuna rotta lo crea, nessuna lo modifica. È il
 * verbale di ciò che è arrivato, e un verbale che si può riscrivere da fuori non
 * è un verbale.
 */
@Service()
export class ExternalSaleEventRepository extends BaseRepository<"externalSaleEvent"> {
    constructor() {
        super("externalSaleEvent");
    }

    /**
     * La consegna già vista. I webhook sono consegnati **almeno una volta** per
     * progetto: la stessa notifica arriva due volte ogni volta che la nostra
     * risposta si perde per strada, ed è un caso normale, non un'anomalia.
     */
    async findByExternalEventId(
        salesChannelId: number,
        externalEventId: string,
        tx?: Prisma.TransactionClient,
    ): Promise<ExternalSaleEvent | null> {
        return this.findOne({ salesChannelId, externalEventId }, undefined, tx);
    }

    /**
     * L'ultima notifica **grezza** ricevuta per un ordine.
     *
     * Serve alla rielaborazione delle quarantene create prima che il modello
     * canonico conoscesse gli sconti (`14` §3.6): il corpo che è arrivato dal
     * negozio è l'unico posto dove quegli sconti esistono ancora, ed è
     * precisamente il motivo per cui questa tabella conserva il corpo grezzo.
     *
     * La più recente, perché lo stesso ordine genera più notifiche legittime e
     * l'ultima è quella che descrive l'ordine come è adesso.
     */
    async findByExternalOrder(
        salesChannelId: number,
        externalOrderId: string,
        take = 10,
        tx?: Prisma.TransactionClient,
    ): Promise<ExternalSaleEvent[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: { salesChannelId, externalOrderId },
                orderBy: { receivedAt: "desc" },
                take,
            })
        );
    }

    async markProcessed(
        id: number,
        status: ExternalSaleEventStatus,
        error: string | null,
        tx?: Prisma.TransactionClient,
    ): Promise<ExternalSaleEvent> {
        return this.exec(() =>
            this.getDelegate(tx).update({
                where: { id },
                data: { status, error, processedAt: new Date() },
            })
        );
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.ExternalSaleEventWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<ExternalSaleEvent>> {
        return this.paginate(
            { AND: [query, relationOrganizationScopeWhere(scope, "salesChannel")] },
            options,
            tx,
        );
    }
}
