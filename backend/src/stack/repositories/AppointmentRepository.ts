import { Appointment, Prisma } from "@prisma/client";
import { Service } from "fastify-decorators";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions } from "@utils/helpers/exz";
import { OrganizationScope, organizationScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class AppointmentRepository extends BaseRepository<"appointment"> {
    constructor() {
        super("appointment");
    }

    /** §1.5 — lo scope di tenancy è obbligatorio e precede la query di dominio. */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.AppointmentWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<Appointment | null> {
        return this.findOne({ AND: [query, organizationScopeWhere(scope)] }, options, tx);
    }

    /** Gli appuntamenti che toccano `[from, to)`, con la sede per nome. */
    async findCalendarInScope(scope: OrganizationScope, from: Date, to: Date, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: {
                    AND: [
                        { deleted: false, startAt: { lt: to }, endAt: { gt: from } },
                        organizationScopeWhere(scope),
                    ],
                },
                include: { venue: { select: { id: true, name: true } } },
                orderBy: { startAt: "asc" },
            })
        );
    }

    /** Le occorrenze vive di una serie, dalla prima o da `fromStartAt` in poi. */
    async findSeries(seriesId: string, fromStartAt?: Date, tx?: Prisma.TransactionClient): Promise<Appointment[]> {
        return this.findMany(
            { seriesId, deleted: false, ...(fromStartAt && { startAt: { gte: fromStartAt } }) },
            { orderBy: { startAt: "asc" } },
            tx,
        );
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<Appointment> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
