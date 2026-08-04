import { Service } from "fastify-decorators";
import { EventType, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions } from "@utils/helpers/exz";

@Service()
export class EventTypeRepository extends BaseRepository<"eventType"> {
    constructor() {
        super("eventType");
    }

    async findBySlug(slug: string, tx?: Prisma.TransactionClient): Promise<EventType | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({ where: { slug, deleted: false } })
        );
    }

    async findAllActive(options?: FindOptions, tx?: Prisma.TransactionClient): Promise<EventType[]> {
        return this.findMany(
            { active: true, deleted: false },
            { ...options, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
            tx,
        );
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<EventType> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
