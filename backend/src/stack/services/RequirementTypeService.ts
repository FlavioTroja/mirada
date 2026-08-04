import { Service } from "fastify-decorators";
import { Prisma, RequirementType } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { isBoolean } from "lodash";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { RequirementTypeRepository } from "@repositories/RequirementTypeRepository";
import { RequirementTypeCreateDTO } from "@DTOs/requirement_type/RequirementTypeCreateDTO";
import { RequirementTypeUpdateDTO } from "@DTOs/requirement_type/RequirementTypeUpdateDTO";
import { RequirementTypeQueryDTO } from "@DTOs/requirement_type/RequirementTypeQueryDTO";

@Service()
export class RequirementTypeService {
    constructor(private readonly requirementTypeRepository: RequirementTypeRepository) {}

    public async save(dto: RequirementTypeCreateDTO): Promise<RequirementType> {
        Log.info(`[RequirementType Service]: creating requirement type of kind '${dto.kind}'`);
        const requirementType = await this.requirementTypeRepository.save(dto);
        Log.info(`[RequirementType Service]: requirement type created (id ${requirementType.id})`);
        return requirementType;
    }

    public async findById(id: number, options?: FindOptions): Promise<RequirementType | null> {
        return this.requirementTypeRepository.findOne({ id, deleted: false }, options);
    }

    public async findAllActive(): Promise<RequirementType[]> {
        return this.requirementTypeRepository.findAllActive();
    }

    public async paginate(query: RequirementTypeQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<RequirementType>> {
        return this.requirementTypeRepository.paginate(this.createQueryFromPayload(query), options);
    }

    public async updateById(id: number, dto: RequirementTypeUpdateDTO): Promise<RequirementType> {
        Log.info(`[RequirementType Service]: updating requirement type (id ${id})`);
        return this.requirementTypeRepository.update({ id }, dto);
    }

    public async safeDeleteById(id: number): Promise<RequirementType> {
        Log.info(`[RequirementType Service]: soft deleting requirement type (id ${id})`);
        return this.requirementTypeRepository.safeDeleteById(id);
    }

    private createQueryFromPayload(payload: RequirementTypeQueryDTO): Prisma.RequirementTypeWhereInput {
        const query: Prisma.RequirementTypeWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(isBoolean(payload.active), { active: payload.active }),
            createObjectWithoutThrow(payload.kind?.length, { kind: { in: payload.kind } }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
