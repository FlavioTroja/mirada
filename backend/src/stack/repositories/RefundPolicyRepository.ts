import { Service } from "fastify-decorators";
import { Prisma, RefundPolicy } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, organizationOrPlatformScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class RefundPolicyRepository extends BaseRepository<"refundPolicy"> {
    constructor() {
        super("refundPolicy");
    }

    async findByOrganization(organizationId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<RefundPolicy[]> {
        return this.findMany({ organizationId, deleted: false }, options, tx);
    }

    /** I preset di piattaforma sono le righe senza organizzazione (§3.4). */
    async findPlatformPresets(options?: FindOptions, tx?: Prisma.TransactionClient): Promise<RefundPolicy[]> {
        return this.findMany({ isPlatformPreset: true, organizationId: null, deleted: false }, options, tx);
    }

    /** §1.5 — lo scope di tenancy è obbligatorio e precede la query di dominio. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.RefundPolicyWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<RefundPolicy | null> {
        return this.findOne({ AND: [query, organizationOrPlatformScopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.RefundPolicyWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<RefundPolicy>> {
        return this.paginate({ AND: [query, organizationOrPlatformScopeWhere(scope)] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<RefundPolicy> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
