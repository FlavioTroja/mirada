import { Service } from "fastify-decorators";
import { DancerProfile, Prisma } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions } from "@utils/helpers/exz";

@Service()
export class DancerProfileRepository extends BaseRepository<"dancerProfile"> {
    constructor() {
        super("dancerProfile");
    }

    async findByUserId(userId: number, options?: FindOptions, tx?: Prisma.TransactionClient): Promise<DancerProfile | null> {
        return this.findOne({ userId, deleted: false }, options, tx);
    }

    async findByNickname(nickname: string, tx?: Prisma.TransactionClient): Promise<DancerProfile | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({ where: { nickname, deleted: false } })
        );
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<DancerProfile> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
