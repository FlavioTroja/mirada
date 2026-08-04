import { Service } from "fastify-decorators";
import { Prisma, QuotaConsumption } from "@prisma/client";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { QuotaConsumptionRepository } from "@repositories/QuotaConsumptionRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { QuotaConsumptionQueryDTO } from "@DTOs/quota_consumption/QuotaConsumptionQueryDTO";

/**
 * `QuotaConsumption` — **sola lettura** (§4.9).
 *
 * Nessun `save`, nessun `update`, nessun `delete`: si scrive **solo** attraverso
 * `CapacityEngineService`. È il registro che rende il rilascio *esatto* anziché
 * *ricostruito*, e una scrittura da fuori lo renderebbe una copia inaffidabile di
 * ciò che i contatori dicono già.
 */
@Service()
export class QuotaConsumptionService {
    constructor(
        private readonly quotaConsumptionRepository: QuotaConsumptionRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<QuotaConsumption | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.quotaConsumptionRepository.findOneInScope(scope, { id }, options);
    }

    public async paginate(
        principalId: number,
        query: QuotaConsumptionQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<QuotaConsumption>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.quotaConsumptionRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    private createQueryFromPayload(payload: QuotaConsumptionQueryDTO): Prisma.QuotaConsumptionWhereInput {
        const query: Prisma.QuotaConsumptionWhereInput[] = [
            createObjectWithoutThrow(payload.capacityQuotaId, { capacityQuotaId: payload.capacityQuotaId }),
            createObjectWithoutThrow(payload.registrationId, { registrationId: payload.registrationId }),
        ].filter(o => Object.values(o).length > 0);

        return query.length ? { AND: query } : {};
    }
}
