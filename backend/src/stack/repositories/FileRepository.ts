import { Service } from "fastify-decorators";
import { File, Prisma } from "@prisma/client";
import { provide } from "inversify-binding-decorators";
import { BaseRepository } from "@repositories/BaseRepository";

@Service()
@provide(FileRepository)
export class FileRepository extends BaseRepository<"file"> {

    constructor() {
        super("file");
    }

    async findByPersonIdAndId(personId: number, fileId: number, tx?: Prisma.TransactionClient): Promise<File> {
        return this.exec(() =>
            this.getDelegate(tx).findFirstOrThrow({
                where: {
                    id: fileId,
                    personFiles: { some: { personId } },
                },
            })
        );
    }

    async findFirstRaw(where: Prisma.FileWhereInput, tx?: Prisma.TransactionClient): Promise<File | null> {
        return this.exec(() =>
            this.getDelegate(tx).findFirst({ where })
        );
    }

    async createRaw(data: Prisma.FileCreateInput, tx?: Prisma.TransactionClient): Promise<File> {
        return this.exec(() =>
            this.getDelegate(tx).create({ data })
        );
    }

}
