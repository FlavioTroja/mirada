import { Service } from "fastify-decorators";
import { OrganizationMember, OrgMemberRole, Prisma, RoleName } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { isBoolean } from "lodash";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { getPrismaClient } from "@utils/adapters/prisma";
import { OrganizationMemberRepository } from "@repositories/OrganizationMemberRepository";
import { RoleToUserRepository } from "@repositories/RoleToUserRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { OrganizationMemberCreateDTO } from "@DTOs/organization_member/OrganizationMemberCreateDTO";
import { OrganizationMemberUpdateDTO } from "@DTOs/organization_member/OrganizationMemberUpdateDTO";
import { OrganizationMemberQueryDTO } from "@DTOs/organization_member/OrganizationMemberQueryDTO";

/**
 * La corrispondenza fra i due enum, scritta a mano invece che con un cast.
 * Hanno gli stessi nomi **oggi**: se `OrgMemberRole` ne guadagnasse uno, un cast
 * lo lascerebbe passare in silenzio e questa mappa fa fallire la compilazione.
 */
const ROLE_OF_MEMBERSHIP: Record<OrgMemberRole, RoleName> = {
    [OrgMemberRole.OWNER]: RoleName.OWNER,
    [OrgMemberRole.EVENT_MANAGER]: RoleName.EVENT_MANAGER,
    [OrgMemberRole.CHECKIN_OPERATOR]: RoleName.CHECKIN_OPERATOR,
};

/** I soli ruoli che una membership giustifica: gli altri non si toccano. */
const MEMBERSHIP_ROLES: RoleName[] = Object.values(ROLE_OF_MEMBERSHIP);

@Service()
export class OrganizationMemberService {
    constructor(
        private readonly organizationMemberRepository: OrganizationMemberRepository,
        private readonly roleToUserRepository: RoleToUserRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async save(principalId: number, dto: OrganizationMemberCreateDTO): Promise<OrganizationMember> {
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, dto.organizationId);

        Log.info(`[OrganizationMember Service]: adding user (id ${dto.userId}) as ${dto.role} of organization (id ${dto.organizationId})`);

        const member = await getPrismaClient().$transaction(async prisma => {
            const created = await this.organizationMemberRepository.save(
                { ...dto, invitedAt: new Date() },
                prisma,
            );
            await this.syncMembershipRoles(dto.userId, prisma);
            return created;
        });

        Log.info(`[OrganizationMember Service]: organization member created (id ${member.id})`);
        return member;
    }

    /**
     * **Allinea i ruoli di un utente alle sue membership**, ed è il solo posto
     * che sa come le due cose si legano.
     *
     * `OrgMemberRole` e `RoleName` sono due enum distinti con gli stessi nomi, e
     * portano informazioni diverse: la membership dice *di quale* organizzazione
     * fai parte, il ruolo dice *cosa* ti è permesso. Erano scritture indipendenti,
     * e la conseguenza si vedeva da entrambi i lati:
     *
     *  - **in ingresso**, chi veniva aggiunto come titolare non riceveva alcun
     *    permesso — proprietario di un'organizzazione su cui non poteva nulla;
     *  - **in uscita**, chi veniva rimosso da un'organizzazione **conservava il
     *    ruolo**, e con esso l'accesso alla prima organizzazione che gli fosse
     *    poi capitata sotto lo scope.
     *
     * Il metodo **riconcilia** invece di aggiungere o togliere in modo puntuale:
     * i ruoli derivati dalle membership devono essere esattamente quelli che le
     * membership attive giustificano. Così vale identico per l'aggiunta, il
     * cambio di ruolo e la rimozione, e un utente che è titolare di due
     * organizzazioni non perde il ruolo uscendo da una sola.
     *
     * Tocca **solo** i tre ruoli derivabili da una membership: `GOD`, `DANCER` e
     * i template legacy non c'entrano nulla e non devono essere sfiorati.
     */
    public async syncMembershipRoles(userId: number, tx?: Prisma.TransactionClient): Promise<void> {
        const memberships = await this.organizationMemberRepository.findMany(
            { userId, deleted: false },
            undefined,
            tx,
        );
        const deserved = new Set<RoleName>(memberships.map(m => ROLE_OF_MEMBERSHIP[m.role]));

        const held = await this.roleToUserRepository.findMany(
            { userId, roleName: { in: MEMBERSHIP_ROLES } },
            undefined,
            tx,
        );
        const heldNames = new Set(held.map(row => row.roleName));

        for (const roleName of deserved) {
            if (heldNames.has(roleName)) continue;
            await this.roleToUserRepository.save({ roleName, userId, isActive: true }, tx);
            Log.info(`[OrganizationMember Service]: role ${roleName} granted to user (id ${userId})`);
        }

        for (const row of held) {
            if (deserved.has(row.roleName)) continue;
            await this.roleToUserRepository.deleteById(row.id, tx);
            Log.info(`[OrganizationMember Service]: role ${row.roleName} revoked from user (id ${userId}) — no membership justifies it`);
        }
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

        // Un cambio di ruolo è anche un cambio di permessi: da responsabile
        // eventi a operatore check-in si perdono capacità, e il ruolo residuo le
        // lascerebbe in mano a chi non le ha più.
        return getPrismaClient().$transaction(async prisma => {
            const updated = await this.organizationMemberRepository.update(
                { id }, dto, undefined, undefined, prisma,
            );
            await this.syncMembershipRoles(member.userId, prisma);
            return updated;
        });
    }

    public async safeDeleteById(principalId: number, id: number): Promise<OrganizationMember> {
        const member = await this.findByIdOrThrow(principalId, id);
        Log.info(`[OrganizationMember Service]: soft deleting organization member (id ${id})`);

        // Chi esce da un'organizzazione **perde il ruolo**, a meno che un'altra
        // membership non continui a giustificarlo. Senza questa riga il ruolo
        // restava addosso e tornava utile alla prima organizzazione che fosse
        // ricapitata sotto lo scope.
        return getPrismaClient().$transaction(async prisma => {
            const deleted = await this.organizationMemberRepository.safeDeleteById(id, prisma);
            await this.syncMembershipRoles(member.userId, prisma);
            return deleted;
        });
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
