import { Service } from "fastify-decorators";
import { Prisma, QuotaConsumption } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/**
 * Il registro di ciò che ogni iscrizione occupa (§4.9). Si scrive **solo**
 * attraverso `CapacityEngineService`: nessun endpoint di creazione, aggiornamento
 * o cancellazione lo espone.
 */
@Service()
export class QuotaConsumptionRepository extends BaseRepository<"quotaConsumption"> {
    constructor() {
        super("quotaConsumption");
    }

    /** I consumi di un'iscrizione — è ciò che rende il rilascio *esatto* (`05` §8). */
    async findByRegistration(registrationId: number, tx?: Prisma.TransactionClient): Promise<QuotaConsumption[]> {
        return this.findMany({ registrationId }, { orderBy: { capacityQuotaId: "asc" } }, tx);
    }

    async findByRegistrations(registrationIds: number[], tx?: Prisma.TransactionClient): Promise<QuotaConsumption[]> {
        if (!registrationIds.length) {
            return [];
        }
        return this.findMany(
            { registrationId: { in: registrationIds } },
            { orderBy: { capacityQuotaId: "asc" } },
            tx,
        );
    }

    /** I consumi che insistono su un insieme di quote — usato dal rilascio di sessione. */
    async findByQuotas(capacityQuotaIds: number[], tx?: Prisma.TransactionClient): Promise<QuotaConsumption[]> {
        if (!capacityQuotaIds.length) {
            return [];
        }
        return this.findMany(
            { capacityQuotaId: { in: capacityQuotaIds } },
            { orderBy: { capacityQuotaId: "asc" } },
            tx,
        );
    }

    async deleteByIds(ids: number[], tx?: Prisma.TransactionClient): Promise<number> {
        if (!ids.length) {
            return 0;
        }
        const result = await this.exec(() =>
            this.getDelegate(tx).deleteMany({ where: { id: { in: ids } } })
        );
        return result.count;
    }

    /**
     * Somma delle `quantity` per quota — è il termine di confronto
     * dell'**invariante I2** (`consumed` coincide con la somma dei consumi
     * collegati), candidata naturale a un controllo periodico con allarme.
     */
    async sumByQuota(capacityQuotaIds: number[], tx?: Prisma.TransactionClient): Promise<Map<number, number>> {
        if (!capacityQuotaIds.length) {
            return new Map();
        }
        const rows = await this.exec(() =>
            this.getDelegate(tx).groupBy({
                by: ["capacityQuotaId"],
                where: { capacityQuotaId: { in: capacityQuotaIds } },
                _sum: { quantity: true },
            })
        );
        return new Map(rows.map(row => [row.capacityQuotaId, row._sum.quantity ?? 0]));
    }

    /** §1.5 — lo scope passa da quota → evento → organizzazione. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.QuotaConsumptionWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<QuotaConsumption | null> {
        return this.findOne({ AND: [query, this.scopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.QuotaConsumptionWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<QuotaConsumption>> {
        return this.paginate({ AND: [query, this.scopeWhere(scope)] }, options, tx);
    }

    private scopeWhere(scope: OrganizationScope): Prisma.QuotaConsumptionWhereInput {
        return {
            capacityQuota: relationOrganizationScopeWhere(scope, "event"),
        } as Prisma.QuotaConsumptionWhereInput;
    }
}
