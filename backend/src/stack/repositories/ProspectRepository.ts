import { Service } from "fastify-decorators";
import { Prisma, Prospect, ProspectStatus } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, organizationScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class ProspectRepository extends BaseRepository<"prospect"> {
    constructor() {
        super("prospect");
    }

    /** §1.5 — lo scope di tenancy è obbligatorio e precede la query di dominio. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.ProspectWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Prospect | null> {
        return this.findOne({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.ProspectWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Prospect>> {
        return this.paginate({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }

    async findManyInScope(
        scope: OrganizationScope,
        query: Prisma.ProspectWhereInput,
        tx?: Prisma.TransactionClient,
    ): Promise<Prospect[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({ where: { AND: [query, organizationScopeWhere(scope)] } })
        );
    }

    /**
     * I prospect che potrebbero essersi iscritti: non ancora convertiti, e con
     * un'email con cui riconoscerli (`19-prospect.md` §4).
     */
    async findUnconvertedWithEmail(scope: OrganizationScope, tx?: Prisma.TransactionClient): Promise<Prospect[]> {
        return this.findManyInScope(scope, { convertedRegistrationId: null, email: { not: null } }, tx);
    }

    async markConverted(id: number, registrationId: number, at: Date, tx?: Prisma.TransactionClient): Promise<Prospect> {
        return this.exec(() =>
            this.getDelegate(tx).update({
                where: { id },
                data: { convertedRegistrationId: registrationId, convertedAt: at },
            })
        );
    }

    async markContacted(ids: number[], at: Date, tx?: Prisma.TransactionClient): Promise<number> {
        return this.exec(async () => {
            const result = await this.getDelegate(tx).updateMany({
                where: { id: { in: ids } },
                data: { status: ProspectStatus.CONTACTED, contactedAt: at },
            });
            return result.count;
        });
    }
}
