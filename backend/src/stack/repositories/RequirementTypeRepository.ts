import { Service } from "fastify-decorators";
import { Prisma, RequirementType } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions } from "@utils/helpers/exz";

@Service()
export class RequirementTypeRepository extends BaseRepository<"requirementType"> {
    constructor() {
        super("requirementType");
    }

    async findAllActive(options?: FindOptions, tx?: Prisma.TransactionClient): Promise<RequirementType[]> {
        return this.findMany({ active: true, deleted: false }, { ...options, orderBy: [{ id: "asc" }] }, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<RequirementType> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }
}
