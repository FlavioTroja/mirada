import { Service } from "fastify-decorators";
import { Prisma, ServiceType } from "@prisma/client";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { isBoolean } from "lodash";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { ServiceTypeRepository } from "@repositories/ServiceTypeRepository";
import { ServiceTypeCreateDTO } from "@DTOs/service_type/ServiceTypeCreateDTO";
import { ServiceTypeUpdateDTO } from "@DTOs/service_type/ServiceTypeUpdateDTO";
import { ServiceTypeQueryDTO } from "@DTOs/service_type/ServiceTypeQueryDTO";

@Service()
export class ServiceTypeService {
    constructor(private readonly serviceTypeRepository: ServiceTypeRepository) {}

    public async save(dto: ServiceTypeCreateDTO): Promise<ServiceType> {
        Log.info(`[ServiceType Service]: creating service type`);
        const serviceType = await this.serviceTypeRepository.save(dto);
        Log.info(`[ServiceType Service]: service type created (id ${serviceType.id})`);
        return serviceType;
    }

    public async findById(id: number, options?: FindOptions): Promise<ServiceType | null> {
        return this.serviceTypeRepository.findOne({ id, deleted: false }, options);
    }

    public async findAllActive(): Promise<ServiceType[]> {
        return this.serviceTypeRepository.findAllActive();
    }

    public async paginate(query: ServiceTypeQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<ServiceType>> {
        return this.serviceTypeRepository.paginate(this.createQueryFromPayload(query), options);
    }

    public async updateById(id: number, dto: ServiceTypeUpdateDTO): Promise<ServiceType> {
        Log.info(`[ServiceType Service]: updating service type (id ${id})`);
        return this.serviceTypeRepository.update({ id }, dto);
    }

    public async safeDeleteById(id: number): Promise<ServiceType> {
        Log.info(`[ServiceType Service]: soft deleting service type (id ${id})`);
        return this.serviceTypeRepository.safeDeleteById(id);
    }

    private createQueryFromPayload(payload: ServiceTypeQueryDTO): Prisma.ServiceTypeWhereInput {
        const query: Prisma.ServiceTypeWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(isBoolean(payload.active), { active: payload.active }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
