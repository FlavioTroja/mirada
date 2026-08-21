import { Service } from "fastify-decorators";
import { Prisma, SalesChannelMapping } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/** Il titolo con l'evento a cui appartiene — ciò che serve a decidere se ingerire. */
export type MappingWithTicketType = Prisma.SalesChannelMappingGetPayload<{
    include: { ticketType: { include: { event: true } } };
}>;

/**
 * La traduzione prodotto del negozio → titolo d'ingresso — fase E.
 *
 * Lo scope del §1.5 passa dal canale, che è l'unico a portare `organizationId`.
 */
@Service()
export class SalesChannelMappingRepository extends BaseRepository<"salesChannelMapping"> {
    constructor() {
        super("salesChannelMapping");
    }

    /**
     * Risolve una riga d'ordine del negozio.
     *
     * ── L'ordine dei tentativi non è arbitrario ─────────────────────────────
     * Prima la **variante esatta**, poi il ripiego su `""` («qualunque variante
     * del prodotto»). Al contrario, una mappatura generica del prodotto
     * scavalcherebbe quella specifica della variante, e il pacchetto «full pass
     * + cena» finirebbe sul titolo del solo full pass — con una cena venduta e
     * mai registrata.
     */
    async resolve(
        salesChannelId: number,
        externalProductId: string,
        externalVariantId: string,
        tx?: Prisma.TransactionClient,
    ): Promise<MappingWithTicketType | null> {
        const candidates = await this.exec(() =>
            this.getDelegate(tx).findMany({
                where: {
                    salesChannelId,
                    externalProductId,
                    externalVariantId: { in: [externalVariantId, ""] },
                    deleted: false,
                },
                include: { ticketType: { include: { event: true } } },
                orderBy: { externalVariantId: "desc" },
            })
        ) as MappingWithTicketType[];

        // `orderBy` decrescente mette la stringa vuota per ultima: il primo
        // elemento è la variante esatta quando esiste.
        return candidates[0] ?? null;
    }

    async findByChannel(salesChannelId: number, tx?: Prisma.TransactionClient): Promise<SalesChannelMapping[]> {
        return this.findMany({ salesChannelId, deleted: false }, { orderBy: { id: "asc" } }, tx);
    }

    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.SalesChannelMappingWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<SalesChannelMapping | null> {
        return this.findOne(
            { AND: [query, relationOrganizationScopeWhere(scope, "salesChannel")] },
            options,
            tx,
        );
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.SalesChannelMappingWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<SalesChannelMapping>> {
        return this.paginate(
            { AND: [query, relationOrganizationScopeWhere(scope, "salesChannel")] },
            options,
            tx,
        );
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<SalesChannelMapping> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
