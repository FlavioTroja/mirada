import { Service } from "fastify-decorators";
import { Organization, PayoutStatus, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, organizationIdScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class OrganizationRepository extends BaseRepository<"organization"> {
    constructor() {
        super("organization");
    }

    /** Usato dal webhook Stripe per risalire dall'account connesso all'organizzazione. */
    async findByStripeAccountId(stripeAccountId: string, tx?: Prisma.TransactionClient): Promise<Organization | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({ where: { stripeAccountId, deleted: false } })
        );
    }

    async findByVatNumber(vatNumber: string, tx?: Prisma.TransactionClient): Promise<Organization | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({ where: { vatNumber, deleted: false } })
        );
    }

    async findAllWithPayoutEnabled(tx?: Prisma.TransactionClient): Promise<Organization[]> {
        return this.findMany({ payoutStatus: PayoutStatus.ENABLED, deleted: false }, undefined, tx);
    }

    /**
     * §1.5 — nessun finder senza contesto di tenancy: lo scope è il primo argomento
     * e non è opzionale. `null` è ammesso solo per GOD.
     */
    /**
     * **Tutte le organizzazioni con i loro titolari** — il registro dei clienti
     * della piattaforma, riservato a `GOD`.
     *
     * I membri sono inclusi nella stessa query: un elenco di venti
     * organizzazioni non deve diventare ventuno interrogazioni, e i titolari
     * sono l'informazione che rende l'elenco utile invece che decorativo.
     */
    async findAllWithMembers(tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: { deleted: false },
                include: {
                    members: {
                        where: { deleted: false },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    person: { select: { name: true, surname: true } },
                                },
                            },
                        },
                        orderBy: { id: "asc" },
                    },
                },
                orderBy: { name: "asc" },
            })
        );
    }

    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.OrganizationWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Organization | null> {
        return this.findOne({ AND: [query, organizationIdScopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.OrganizationWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Organization>> {
        return this.paginate({ AND: [query, organizationIdScopeWhere(scope)] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Organization> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
