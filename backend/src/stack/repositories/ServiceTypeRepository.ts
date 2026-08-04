import { Service } from "fastify-decorators";
import { Prisma, ServiceType } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions } from "@utils/helpers/exz";

@Service()
export class ServiceTypeRepository extends BaseRepository<"serviceType"> {
    constructor() {
        super("serviceType");
    }

    async findAllActive(options?: FindOptions, tx?: Prisma.TransactionClient): Promise<ServiceType[]> {
        return this.findMany({ active: true, deleted: false }, { ...options, orderBy: [{ id: "asc" }] }, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<ServiceType> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
