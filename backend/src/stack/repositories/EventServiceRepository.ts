import { Service } from "fastify-decorators";
import { EventService, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

/** Servizi accessori dell'evento (`EventService` del §3.6), non il layer di servizio. */
@Service()
export class EventServiceRepository extends BaseRepository<"eventService"> {
    constructor() {
        super("eventService");
    }

    async findByEvent(eventId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<EventService[]> {
        return this.findMany({ eventId, deleted: false }, { ...options, orderBy: { sortOrder: "asc" } }, tx);
    }

    /** §1.5 — lo scope passa dall'evento. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.EventServiceWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<EventService | null> {
        return this.findOne({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.EventServiceWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<EventService>> {
        return this.paginate({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<EventService> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
