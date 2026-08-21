import { Service } from "fastify-decorators";
import { ExternalSale, ExternalSaleStatus, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/** Numero di vendite recuperate a ogni passata di ripresa. Vedi `ExternalSalesReconciliationJob`. */
export const RETRY_BATCH_SIZE = 50;

/**
 * La vendita dichiarata da un negozio esterno — fase E.
 *
 * Lo scope del §1.5 passa dal canale: `eventId` è nullo in quarantena e non può
 * quindi essere la strada della tenancy.
 */
@Service()
export class ExternalSaleRepository extends BaseRepository<"externalSale"> {
    constructor() {
        super("externalSale");
    }

    /**
     * La difesa contro la doppia ingestione, letta **dentro** la transazione che
     * sta per ingerire. Il vincolo `@@unique([salesChannelId, externalOrderId])`
     * resta l'ultima parola — questa lettura evita solo di arrivarci per la
     * strada lunga, cioè dopo aver emesso biglietti.
     */
    async findByExternalOrder(
        salesChannelId: number,
        externalOrderId: string,
        tx?: Prisma.TransactionClient,
    ): Promise<ExternalSale | null> {
        return this.findOne({ salesChannelId, externalOrderId }, undefined, tx);
    }

    /**
     * Ciò che la passata di ripresa deve riprovare: quello che è fallito per una
     * ragione tecnica e quello che non è mai stato elaborato.
     *
     * **La quarantena non è qui dentro**, ed è deliberato: una vendita in
     * quarantena aspetta una decisione umana — una mappatura che non esiste non
     * si materializza riprovando, e ritentarla ogni dieci minuti riempirebbe il
     * registro di errori identici nascondendo quelli veri.
     */
    async findRetryable(limit: number = RETRY_BATCH_SIZE, tx?: Prisma.TransactionClient): Promise<ExternalSale[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: {
                    status: { in: [ExternalSaleStatus.RECEIVED, ExternalSaleStatus.FAILED] },
                    deleted: false,
                },
                orderBy: { receivedAt: "asc" },
                take: limit,
            }),
        ) as Promise<ExternalSale[]>;
    }

    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.ExternalSaleWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<ExternalSale | null> {
        return this.findOne(
            { AND: [query, relationOrganizationScopeWhere(scope, "salesChannel")] },
            options,
            tx,
        );
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.ExternalSaleWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<ExternalSale>> {
        return this.paginate(
            { AND: [query, relationOrganizationScopeWhere(scope, "salesChannel")] },
            options,
            tx,
        );
    }

    /** Quante vendite di un canale aspettano una mano umana — il badge del back-office. */
    async countQuarantined(salesChannelId: number, tx?: Prisma.TransactionClient): Promise<number> {
        return this.count(
            { salesChannelId, status: ExternalSaleStatus.QUARANTINED, deleted: false },
            tx,
        );
    }
}
