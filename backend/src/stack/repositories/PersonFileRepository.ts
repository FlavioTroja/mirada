import { Prisma } from "@prisma/client";
import { Service } from "fastify-decorators";
import { BaseRepository } from "@repositories/BaseRepository";

@Service()
export class PersonFileRepository extends BaseRepository<"personFile"> {
    constructor() {
        super("personFile");
    }

    async link(personId: number, fileId: number, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).create({ data: { personId, fileId } })
        );
    }

    async linkMany(personId: number, fileIds: number[], tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).createMany({
                data: fileIds.map(fileId => ({ personId, fileId })),
                skipDuplicates: true,
            })
        );
    }

    async unlink(personId: number, fileId: number, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).delete({ where: { personId_fileId: { personId, fileId } } })
        );
    }
}
