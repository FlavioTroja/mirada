import { Activity, Prisma } from "@prisma/client";
import { Service } from "fastify-decorators";
import { BaseRepository } from "@repositories/BaseRepository";
import { OrganizationScope, organizationScopeWhere } from "@utils/helpers/organizationScope";

@Service()
export class ActivityRepository extends BaseRepository<"activity"> {
    constructor() {
        super("activity");
    }

    /** Le righe più recenti, dalla più nuova, nelle organizzazioni del chiamante. */
    async findRecentInScope(
        scope: OrganizationScope,
        since: Date,
        limit: number,
        staffOnly: boolean,
        tx?: Prisma.TransactionClient,
    ): Promise<Activity[]> {
        return this.exec(() =>
            this.getDelegate(tx).findMany({
                where: {
                    AND: [
                        { createdAt: { gte: since }, ...(staffOnly && { staff: true }) },
                        organizationScopeWhere(scope),
                    ],
                },
                orderBy: { createdAt: "desc" },
                take: limit,
            })
        );
    }

    /** La cronaca recente, non l'archivio: via le righe più vecchie di `before`. */
    async deleteOlderThan(before: Date, tx?: Prisma.TransactionClient): Promise<number> {
        return this.exec(async () => {
            const result = await this.getDelegate(tx).deleteMany({ where: { createdAt: { lt: before } } });
            return result.count;
        });
    }
}
