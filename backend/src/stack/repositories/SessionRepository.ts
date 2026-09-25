import { Service } from "fastify-decorators";
import { Prisma, Session } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope, relationOrganizationScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class SessionRepository extends BaseRepository<"session"> {
    constructor() {
        super("session");
    }

    async findByEvent(eventId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<Session[]> {
        return this.findMany({ eventId, deleted: false }, { ...options, orderBy: [{ sortOrder: "asc" }, { startAt: "asc" }] }, tx);
    }

    async countByEvent(eventId: number, tx?: Prisma.TransactionClient): Promise<number> {
        return this.count({ eventId, deleted: false }, tx);
    }

    /** §1.5 — la sessione non porta `organizationId`: lo scope passa dall'evento. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.SessionWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Session | null> {
        return this.findOne({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.SessionWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<Session>> {
        return this.paginate({ AND: [query, relationOrganizationScopeWhere(scope, "event")] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Session> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }

    /**
     * Le sessioni che toccano `[from, to)` nelle organizzazioni del chiamante,
     * per la griglia del calendario (`20-calendario.md` §3). **Anche le
     * annullate**: la scuola deve vedere che quella lezione salta. Con l'evento
     * quanto basta a colorarle e a dire di chi sono.
     */
    async findCalendarInScope(scope: OrganizationScope, from: Date, to: Date, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: {
                    AND: [
                        { deleted: false, startAt: { lt: to }, endAt: { gt: from }, event: { deleted: false } },
                        relationOrganizationScopeWhere(scope, "event"),
                    ],
                },
                include: {
                    event: {
                        select: {
                            id: true,
                            organizationId: true,
                            title: true,
                            status: true,
                            cancelledAt: true,
                            venue: { select: { id: true, name: true } },
                            eventType: { select: { family: true, sessionsLabel: true } },
                        },
                    },
                },
                orderBy: { startAt: "asc" },
            })
        );
    }

    /**
     * Le occorrenze vive di una serie, dalla prima o da `fromStartAt` in poi,
     * **con il numero di check-in**: è ciò che decide se un'occorrenza si può
     * ancora eliminare.
     */
    async findSeries(seriesId: string, fromStartAt?: Date, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: {
                    seriesId,
                    deleted: false,
                    ...(fromStartAt && { startAt: { gte: fromStartAt } }),
                },
                include: { _count: { select: { checkIns: true } } },
                orderBy: { startAt: "asc" },
            })
        );
    }
}
