import { Service } from "fastify-decorators";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions } from "@utils/helpers/exz";
import { Prisma } from "@prisma/client";
import { getPopulateOptions } from "@utils/adapters/prisma";

@Service()
export class ContactRepository extends BaseRepository<"contact"> {

    constructor() {
        super("contact");
    }

    async findById(id: number, options?: FindOptions, tx?: Prisma.TransactionClient) {
        return this.exec(() =>
            this.getDelegate(tx).findUniqueOrThrow({
                where: { id },
                include: options?.populate ? getPopulateOptions(options.populate) : undefined,
            })
        )
    }
}