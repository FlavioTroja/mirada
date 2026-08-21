import { Service } from "fastify-decorators";
import { Prisma, SalesChannel, SalesChannelProvider, SalesChannelStatus } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, organizationScopeWhere } from "@utils/helpers/organizationScope";

/**
 * Il negozio esterno collegato a un'organizzazione — fase E.
 *
 * Porta `organizationId` in colonna, quindi lo scope del §1.5 è diretto.
 */
@Service()
export class SalesChannelRepository extends BaseRepository<"salesChannel"> {
    constructor() {
        super("salesChannel");
    }

    /**
     * Il canale a cui una notifica dice di appartenere. **Non filtra sullo
     * stato**: un canale in pausa o disconnesso deve essere trovato, altrimenti
     * la richiesta uscirebbe come `404` e il prestatore la riproverebbe per ore
     * come se fosse un guasto nostro. Cosa farne lo decide il servizio.
     */
    async findByPublicId(publicId: string, tx?: Prisma.TransactionClient): Promise<SalesChannel | null> {
        return this.findOne({ publicId, deleted: false }, undefined, tx);
    }

    /** Lo stesso negozio non può essere collegato a due organizzazioni. */
    async findByShop(
        provider: SalesChannelProvider,
        externalShopId: string,
        tx?: Prisma.TransactionClient,
    ): Promise<SalesChannel | null> {
        return this.findOne({ provider, externalShopId, deleted: false }, undefined, tx);
    }

    /** I canali che la passata di riconciliazione deve interrogare. */
    async findActive(tx?: Prisma.TransactionClient): Promise<SalesChannel[]> {
        return this.findMany(
            { status: SalesChannelStatus.ACTIVE, deleted: false },
            { orderBy: { id: "asc" } },
            tx,
        );
    }

    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.SalesChannelWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<SalesChannel | null> {
        return this.findOne({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.SalesChannelWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<SalesChannel>> {
        return this.paginate({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<SalesChannel> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
