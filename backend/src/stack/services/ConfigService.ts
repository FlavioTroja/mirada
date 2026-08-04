import { Service } from "fastify-decorators";
import { Config, Prisma, UiScope } from "@prisma/client";
import { PaginateOptions } from "@utils/helpers/exz";
import { ConfigRepository } from "@repositories/ConfigRepository";
import {
    createFullTextQuery,
    createObjectWithoutThrow,
    FullTextOperator
} from "@utils/helpers/query";
import { z } from "zod";
import { provide } from "inversify-binding-decorators";
import { InternalServerError } from "http-errors";
import { EvaluatedConfigDTO, EvaluatedConfigSchema } from "@DTOs/config/ConfigCreateDTO";
import { ConfigQueryDTO } from "@DTOs/config/ConfigQueryDTO";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";

@Service()
@provide(ConfigService)
export class ConfigService {
    constructor(private readonly configRepository: ConfigRepository) {}

    public async findManyByScope(scope: string): Promise<EvaluatedConfigDTO[] | null> {
        const res =  await this.configRepository.findMany({ scope });
        return z.array(EvaluatedConfigSchema).parse(res ?? []);
    }

    public async findByName(name: string): Promise<EvaluatedConfigDTO> {
        const config = await this.configRepository.findOne({ name });
        if (!config) {
            throw new InternalServerError(`Attenzione! La configurazione '${name}' non è stata trovata.`);
        }

        return EvaluatedConfigSchema.parse(config);
    }

    public async findOne(query: Prisma.ConfigWhereInput): Promise<Config | null> {
        return await this.configRepository.findOne(query);
    }

    public async paginate(query: ConfigQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<Config> | null> {
        const prismaQuery = this.createQueryFromPayload(query);

        return await this.configRepository.paginate(prismaQuery, options) as PaginateDatasourceDTO<Config>;
    }

    public async findAllByScopes(query: ConfigQueryDTO, uiScopes: UiScope[]): Promise<Map<string, any>> {
        const prismaQuery = this.createQueryFromPayload(query);

        const res = EvaluatedConfigSchema.array().parse((await this.configRepository.findMany({
            ...prismaQuery,
            uiScope: { in: uiScopes }
        })) ?? []);

        return res.reduce((prev, curr) => ({
            ...prev,
            [curr.name] : curr.value
        }), new Map<string, any>());
    }

    private createQueryFromPayload(payload: ConfigQueryDTO): Prisma.ConfigWhereInput {
        const valueQuery: Prisma.ConfigWhereInput[] = [
            createObjectWithoutThrow(payload.name, { name: { contains: payload.name, mode: "insensitive" } }),
            createObjectWithoutThrow(
                payload.name,
                { name: { search: createFullTextQuery(FullTextOperator.AND, payload.name, true) } },
            ),
            createObjectWithoutThrow(payload.scope, { scope: { contains: payload.scope, mode: "insensitive" } }),
            createObjectWithoutThrow(
                payload.scope,
                { scope: { search: createFullTextQuery(FullTextOperator.AND, payload.scope, true) } },
            ),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.ConfigWhereInput[] = [
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(payload.uiScope, { uiScope: payload.uiScope }),
        ].filter(o => Object.values(o).length > 0);

        return {
            AND: query.length > 0 ? query : undefined,
        };
    };

}
