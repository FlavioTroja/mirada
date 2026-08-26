import { Service } from "fastify-decorators";
import { BalanceSettlement, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope } from "@utils/helpers/organizationScope";

/**
 * Il registro dei saldi incassati al botteghino — `14` §6.
 *
 * ── Lo scope passa per due relazioni, non per una ───────────────────────────
 * `BalanceSettlement` non porta `organizationId` e nemmeno `eventId`: discende da
 * `Organization` attraverso `registration → event`. `relationOrganizationScopeWhere`
 * copre un salto solo, quindi il filtro del §1.5 è scritto qui per esteso — non
 * per fare un'eccezione alla regola, ma perché è l'unico modo di rispettarla.
 */
@Service()
export class BalanceSettlementRepository extends BaseRepository<"balanceSettlement"> {
    constructor() {
        super("balanceSettlement");
    }

    /** Il filtro di tenancy: le righe degli eventi dell'organizzazione del chiamante. */
    private scopeWhere(scope: OrganizationScope): Prisma.BalanceSettlementWhereInput {
        return scope === null ? {} : { registration: { event: { organizationId: { in: scope } } } };
    }

    async findByRegistration(
        registrationId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<BalanceSettlement[]> {
        return this.findMany(
            { registrationId, deleted: false },
            { orderBy: { collectedAt: "asc" } },
            tx,
        );
    }

    /**
     * La riga che quel dispositivo ha già mandato.
     *
     * È l'idempotenza della coda offline: un telefono che sincronizza due volte
     * la stessa riscossione non deve incassarla due volte. Distinta dal
     * **doppio incasso** vero — due postazioni diverse sulla stessa persona —
     * che invece una riga la crea eccome, marcata come conflitto (`RF-SAL-11`).
     */
    async findByDeviceReference(
        deviceId: string,
        deviceReference: string,
        tx?: Prisma.TransactionClient,
    ): Promise<BalanceSettlement | null> {
        return this.findOne({ deviceId, deviceReference }, undefined, tx);
    }

    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.BalanceSettlementWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<BalanceSettlement | null> {
        return this.findOne({ AND: [query, this.scopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.BalanceSettlementWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<BalanceSettlement>> {
        return this.paginate({ AND: [query, this.scopeWhere(scope)] }, options, tx);
    }
}
