import { Service } from "fastify-decorators";
import { LogRepository } from "@repositories/LogRepository";
import { UserRepository } from "@repositories/UserRepository";
import { PaginateOptions } from "@utils/helpers/exz";
import { Log, Prisma } from "@prisma/client";
import { provide } from "inversify-binding-decorators";
import { WsPublisherService } from "@websocket/publisher/WsPublisherService";
import { Events } from "@websocket/events/Events";
import { createFullTextQuery, createObjectWithoutThrow, FullTextOperator } from "@utils/helpers/query";
import { isBoolean } from "lodash";
import { Log as Logger } from "@utils/adapters/log";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { getPrismaClient } from "@utils/adapters/prisma";
import { LogCreateDTO } from "@DTOs/log/LogCreateDTO";
import { RecipientDTO } from "@DTOs/log/RecipientDTO";
import { LogQueryDTO } from "@DTOs/log/LogQueryDTO";
import { LogCreateAndNotifyDTO } from "@DTOs/log/LogCreateAndNotifyDTO";

@Service()
@provide(LogService)
export class LogService {

    constructor(
        private readonly logRepository: LogRepository,
        private readonly userRepository: UserRepository,
        private readonly eventPublisher: WsPublisherService
    ) {}

    public async save(dto: LogCreateDTO): Promise<Log | null> {
        return await this.logRepository.save(dto);
    }

    public async findById(id: number): Promise<Log | null> {
        return await this.logRepository.findById(id);
    }

    public async findOne(query: Prisma.LogWhereInput): Promise<Log | null> {
        return await this.logRepository.findOne(query);
    }

    public async findMany(query: Prisma.LogWhereInput, options?: PaginateOptions): Promise<Log[]> {
        return await this.logRepository.findMany(query, options);
    }

    public async paginate(query: LogQueryDTO, options: PaginateOptions): Promise<PaginateDatasourceDTO<Log> | null> {
        const prismaQuery = this.createQueryFromPayload(query);

        return await this.logRepository.paginate(prismaQuery, options) as PaginateDatasourceDTO<Log>;
    }

    public async saveAndNotify(
        dto: LogCreateAndNotifyDTO,
        noticeExtras: Record<string, unknown> = {},
    ): Promise<Log | null> {
        const roleUsers = await this.userRepository.findMany({
            roles: { some: { roleName: { in: dto.toRoles || [] } } }
        });

        const actionBy = dto.actionById ? await this.userRepository.findById(dto.actionById) : null;
        const saved = await this.safeSave({
            ...dto,
            actionByUsername: actionBy?.username || "",
            recipients: roleUsers.map(user => ({ userId: user.id, isRead: false })),
        });

        await this.eventPublisher.sendToUsers(
            roleUsers.map(user => user.wsCode || '').filter(s => !!s),
            Events.LOG_NOTIFICATION,
            { level: dto.level, message: dto.description ?? undefined, ...noticeExtras }
        );

        return saved;
    }

    public async safeSave(dto: LogCreateDTO) {
        try {
            return await this.save(dto);
        } catch (err) {
            Logger.error(`Error specification: [ ${JSON.stringify(err)} ] when save log: `, JSON.stringify(dto));
            return null;
        }
    }

    public async toggleRead(id: number, userId: number): Promise<Log> {
        const log = await this.logRepository.findById(id);

        return await this.logRepository.update({ id }, {
            recipients: (log.recipients as RecipientDTO[]).map(recipient => {
                if (recipient.userId !== userId) {
                    return recipient;
                }
                return { ...recipient, isRead: !recipient.isRead };
            })
        });
    }

    private createQueryFromPayload(payload: LogQueryDTO, userId?: number): Prisma.LogWhereInput {
        const valueQuery: Prisma.LogWhereInput[] = [
            createObjectWithoutThrow(payload.value, { description: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(
                payload.value,
                { description: { search: createFullTextQuery(FullTextOperator.AND, payload.value, true) } },
            ),
            createObjectWithoutThrow(payload.value, { entityName: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(
                payload.value,
                { entityName: { search: createFullTextQuery(FullTextOperator.AND, payload.value, true) } },
            ),
            createObjectWithoutThrow(payload.value, { causedByUsername: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(
                payload.value,
                { causedByUsername: { search: createFullTextQuery(FullTextOperator.AND, payload.value, true) } },
            ),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.LogWhereInput[] = [
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),

            createObjectWithoutThrow(payload.level?.length, { level: { in: payload.level } }),
            createObjectWithoutThrow(isBoolean(payload.isNotification), { isNotification: payload.isNotification }),

            createObjectWithoutThrow(payload.toRoles?.length, { toRoles: { hasSome: payload.toRoles } }),
            createObjectWithoutThrow(payload.causedByCreatedAt, { createdAt: { gt: new Date(payload.causedByCreatedAt!) } }),
            createObjectWithoutThrow(isBoolean(payload.isRead) && userId, { recipients: { array_contains: [ { isRead: payload.isRead, userId: userId } ] } }),

        ].filter(o => Object.values(o).length > 0);

        return {
            AND: query.length > 0 ? query : undefined,
        };
    };

    public async setAllReadByUser(userId: number): Promise<{ done: boolean }> {
        await getPrismaClient().$transaction(prisma => this.logRepository.markAllReadByUser(userId, prisma));
        return { done: true };
    }
}
