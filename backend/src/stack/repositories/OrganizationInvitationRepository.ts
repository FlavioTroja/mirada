import { Prisma } from "@prisma/client";
import { Service } from "fastify-decorators";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { organizationScopeWhere, OrganizationScope } from "@utils/helpers/organizationScope";

@Service()
export class OrganizationInvitationRepository extends BaseRepository<"organizationInvitation"> {
    constructor() {
        super("organizationInvitation");
    }

    /**
     * L'invito che corrisponde a questa impronta, se è ancora spendibile.
     *
     * I tre motivi per cui un invito non vale più — revocato, già accettato,
     * scaduto — sono filtrati **qui dentro**: è l'unico modo perché nessun
     * chiamante possa dimenticarsene, e dimenticarne uno solo significa
     * riaprire una porta che qualcuno credeva di aver chiuso.
     */
    async findSpendibileByHash(
        tokenHash: string,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ) {
        return this.findOne(
            {
                tokenHash,
                revokedAt: null,
                acceptedAt: null,
                expiresAt: { gt: new Date() },
            },
            options,
            tx,
        );
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.OrganizationInvitationWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Prisma.$OrganizationInvitationPayload["scalars"]> | null> {
        return this.paginate({ AND: [query, organizationScopeWhere(scope)] }, options, tx) as never;
    }
}
