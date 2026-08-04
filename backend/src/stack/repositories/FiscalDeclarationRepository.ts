import { Service } from "fastify-decorators";
import { FiscalDeclaration, FiscalDeclarationKind, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, organizationScopeWhere } from "@utils/helpers/organizationScope";

/**
 * La dichiarazione fiscale è IMMUTABILE (§4.3): questo repository non espone
 * `update` né cancellazione. `BaseRepository.update` resta ereditato ma nessun
 * servizio del progetto lo invoca su questo modello.
 */
@Service()
export class FiscalDeclarationRepository extends BaseRepository<"fiscalDeclaration"> {
    constructor() {
        super("fiscalDeclaration");
    }

    async findByOrganization(organizationId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<FiscalDeclaration[]> {
        return this.findMany({ organizationId, deleted: false }, options, tx);
    }

    /**
     * Ultima versione della serie `(organizationId, kind, eventId)`. È la base del
     * progressivo: il servizio scrive `version = (latest?.version ?? 0) + 1`
     * dentro la stessa transazione della creazione.
     */
    async findLatestVersion(
        organizationId: number,
        kind: FiscalDeclarationKind,
        eventId: number | null,
        tx?: Prisma.TransactionClient,
    ): Promise<FiscalDeclaration | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({
                where: { organizationId, kind, eventId },
                orderBy: { version: "desc" },
            })
        );
    }

    /** §1.5 — lo scope di tenancy è obbligatorio e precede la query di dominio. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.FiscalDeclarationWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<FiscalDeclaration | null> {
        return this.findOne({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.FiscalDeclarationWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<FiscalDeclaration>> {
        return this.paginate({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }
}
