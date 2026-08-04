import { Service } from "fastify-decorators";
import { OrganizationMember, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, organizationScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class OrganizationMemberRepository extends BaseRepository<"organizationMember"> {
    constructor() {
        super("organizationMember");
    }

    /**
     * §4.3 — è il finder che risolve il contesto di tenancy di ogni richiesta
     * autenticata: da qui nasce l'`OrganizationScope` del §1.5.
     */
    async findByUser(userId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<OrganizationMember[]> {
        return this.findMany({ userId, deleted: false }, options, tx);
    }

    async findOrganizationIdsByUser(userId: number, tx?: Prisma.TransactionClient): Promise<number[]> {
        const memberships = await this.findByUser(userId, undefined, tx);
        return [...new Set(memberships.map(m => m.organizationId))];
    }

    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.OrganizationMemberWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<OrganizationMember | null> {
        return this.findOne({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.OrganizationMemberWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<OrganizationMember>> {
        return this.paginate({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<OrganizationMember> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
