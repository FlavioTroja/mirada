import { Service } from "fastify-decorators";
import { HiddenComponentConfig, Prisma, RoleName } from "@prisma/client";
import { PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { isBoolean } from "lodash";
import httpErrors from "http-errors";
import { HiddenComponentDTO, HiddenComponentFinalDTO } from "@DTOs/hidden_component_config/HiddenComponentDTO";
import { HiddenComponentConfigRepository } from "@repositories/HiddenComponentConfigRepository";
import { HiddenComponentConfigUpdateDTO } from "@DTOs/hidden_component_config/HiddenComponentConfigUpdateDTO";
import { HiddenComponentConfigCreateDTO } from "@DTOs/hidden_component_config/HiddenComponentConfigCreateDTO";
import { HiddenComponentConfigQueryDTO } from "@DTOs/hidden_component_config/HiddenComponentConfigQueryDTO";
import { getPrismaClient } from "@utils/adapters/prisma";
import { HiddenComponentConfigCreateDTOTransformer } from "@transformers//HiddenComponentConfigCreateDTOTransformer";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";


@Service()
export class HiddenComponentConfigService {
    constructor(
        private readonly hiddenComponentConfigRepository: HiddenComponentConfigRepository,
    ) {}

    public async save(dto: HiddenComponentConfigCreateDTO) {
        if (dto.roles.includes(RoleName.GOD)) {
            throw httpErrors.BadRequest("Attenzione! Non è possibile nascondere componenti agli utenti GOD")
        }

        const transformer = new HiddenComponentConfigCreateDTOTransformer();
        const dtoSplit = transformer.transform(dto);

        return getPrismaClient().$transaction(async prisma => {
            const res = [];

            for (const hcc of dtoSplit.hiddenComponentConfigs()) {
                res.push(await this.hiddenComponentConfigRepository.save(hcc, prisma))
            }

            return res;
        })
    }

    public async getHiddenComponents(userId: number): Promise<HiddenComponentFinalDTO> {

        return this.toFinalDTO(await this.hiddenComponentConfigRepository.findHiddenComponentsForRolesCombination(userId));

    }

    private toFinalDTO(dtos: HiddenComponentDTO[]): HiddenComponentFinalDTO {

        return dtos.reduce((result, curr) => {

            const { context, section, component } = curr;

            if (!result[context]) {
                result[context] = {};
            }
            if (!result[context]![section]) {
                result[context]![section] = [];
            }

            result[context]![section]!.push(component);
            return result
        }, {} as HiddenComponentFinalDTO);

    }

    public findById(id: number) {
        return this.hiddenComponentConfigRepository.findById(id);
    }
    
    public async paginate(query: HiddenComponentConfigQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<HiddenComponentConfig> | null> {
        const prismaQuery = this.createQueryFromPayload(query);

        return await this.hiddenComponentConfigRepository.paginate(prismaQuery, options);
    }
    
    private createQueryFromPayload(payload: HiddenComponentConfigQueryDTO): Prisma.HiddenComponentConfigWhereInput {
        const valueQuery: Prisma.HiddenComponentConfigWhereInput[] = [
            createObjectWithoutThrow(payload.value, { context: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { section: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { component: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.HiddenComponentConfigWhereInput[] = [
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),

            createObjectWithoutThrow(isBoolean(payload.isActive), {isActive: payload.isActive}),
            createObjectWithoutThrow(payload.roles?.length, { roleName: { in: payload.roles } }),
        ].filter(o => Object.values(o).length > 0);

        return {
            AND: query.length > 0 ? query : undefined,
        };
    }
    
     public async updateById(id: number, dto: HiddenComponentConfigUpdateDTO): Promise<HiddenComponentConfig | null> {
        return await this.hiddenComponentConfigRepository.updateById(id, dto);
    }

}
