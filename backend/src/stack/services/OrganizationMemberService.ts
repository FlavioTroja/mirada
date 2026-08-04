import { Service } from "fastify-decorators";
import { OrganizationMember, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { isBoolean } from "lodash";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationMemberRepository } from "@repositories/OrganizationMemberRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { OrganizationMemberCreateDTO } from "@DTOs/organization_member/OrganizationMemberCreateDTO";
import { OrganizationMemberUpdateDTO } from "@DTOs/organization_member/OrganizationMemberUpdateDTO";
import { OrganizationMemberQueryDTO } from "@DTOs/organization_member/OrganizationMemberQueryDTO";

@Service()
export class OrganizationMemberService {
    constructor(
        private readonly organizationMemberRepository: OrganizationMemberRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async save(principalId: number, dto: OrganizationMemberCreateDTO): Promise<OrganizationMember> {
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, dto.organizationId);

        Log.info(`[OrganizationMember Service]: adding user (id ${dto.userId}) as ${dto.role} of organization (id ${dto.organizationId})`);
        const member = await this.organizationMemberRepository.save({ ...dto, invitedAt: new Date() });
        Log.info(`[OrganizationMember Service]: organization member created (id ${member.id})`);
        return member;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<OrganizationMember | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.organizationMemberRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    /** §4.3 — risolve il contesto di tenancy di ogni richiesta autenticata. */
    public async findByUser(userId: number, options?: FindOptions): Promise<OrganizationMember[]> {
        return this.organizationMemberRepository.findByUser(userId, options);
    }

    public async paginate(
        principalId: number,
        query: OrganizationMemberQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<OrganizationMember>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.organizationMemberRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: OrganizationMemberUpdateDTO): Promise<OrganizationMember> {
        const member = await this.findByIdOrThrow(principalId, id);
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, dto.organizationId ?? member.organizationId);

        Log.info(`[OrganizationMember Service]: updating organization member (id ${id})`);
        return this.organizationMemberRepository.update({ id }, dto);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<OrganizationMember> {
        await this.findByIdOrThrow(principalId, id);
        Log.info(`[OrganizationMember Service]: soft deleting organization member (id ${id})`);
        return this.organizationMemberRepository.safeDeleteById(id);
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<OrganizationMember> {
        const member = await this.findById(principalId, id);
        if (!member) {
            Log.warn(`[OrganizationMember Service]: organization member (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Membro dell'organizzazione non trovato.");
        }
        return member;
    }

    private createQueryFromPayload(payload: OrganizationMemberQueryDTO): Prisma.OrganizationMemberWhereInput {
        const query: Prisma.OrganizationMemberWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(payload.organizationId, { organizationId: payload.organizationId }),
            createObjectWithoutThrow(payload.userId, { userId: payload.userId }),
            createObjectWithoutThrow(payload.role?.length, { role: { in: payload.role } }),
            createObjectWithoutThrow(isBoolean(payload.accepted), {
                acceptedAt: payload.accepted ? { not: null } : null,
            }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
