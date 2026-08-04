import { Service } from "fastify-decorators";
import { Organization, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationRepository } from "@repositories/OrganizationRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { OrganizationCreateDTO } from "@DTOs/organization/OrganizationCreateDTO";
import { OrganizationUpdateDTO } from "@DTOs/organization/OrganizationUpdateDTO";
import { OrganizationQueryDTO } from "@DTOs/organization/OrganizationQueryDTO";

@Service()
export class OrganizationService {
    constructor(
        private readonly organizationRepository: OrganizationRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    /**
     * Nel primo taglio le organizzazioni sono create a mano da `GOD`: non esiste
     * coda di approvazione self-service (§4.2).
     */
    public async save(dto: OrganizationCreateDTO): Promise<Organization> {
        Log.info(`[Organization Service]: creating organization '${dto.name}'`);
        const organization = await this.organizationRepository.save(dto);
        Log.info(`[Organization Service]: organization created '${organization.name}' (id ${organization.id})`);
        return organization;
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<Organization | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.organizationRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: OrganizationQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<Organization>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.organizationRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    public async updateById(principalId: number, id: number, dto: OrganizationUpdateDTO): Promise<Organization> {
        await this.findByIdOrThrow(principalId, id);
        Log.info(`[Organization Service]: updating organization (id ${id})`);
        return this.organizationRepository.update({ id }, dto);
    }

    public async safeDeleteById(principalId: number, id: number): Promise<Organization> {
        await this.findByIdOrThrow(principalId, id);
        Log.info(`[Organization Service]: soft deleting organization (id ${id})`);
        return this.organizationRepository.safeDeleteById(id);
    }

    /** Cruscotto dello stato di incasso — `GET /organizations/:id/payout-status` (`RF-ORG-12`). */
    public async findPayoutStatus(principalId: number, id: number) {
        const organization = await this.findByIdOrThrow(principalId, id);
        return {
            id: organization.id,
            stripeAccountId: organization.stripeAccountId,
            payoutStatus: organization.payoutStatus,
            payoutCheckedAt: organization.payoutCheckedAt,
        };
    }

    /**
     * TODO (fase B — Stripe): interroga l'account connesso e aggiorna
     * `payoutStatus`/`payoutCheckedAt` (§4.2). Richiede l'adapter Stripe, che nella
     * fase A non esiste ancora: finché manca il metodo non deve mentire allo staff
     * restituendo uno stato non verificato.
     */
    public async refreshPayoutStatus(organizationId: number): Promise<Organization> {
        Log.warn(`[Organization Service]: refreshPayoutStatus not available yet for organization (id ${organizationId}) — Stripe adapter missing`);
        throw new httpErrors.NotImplemented(
            "La verifica dell'abilitazione all'incasso non è ancora disponibile.",
        );
    }

    /**
     * Unico punto di scrittura di `payoutStatus`/`stripeAccountId`: sono campi
     * calcolati dal server e non compaiono in nessun DTO di scrittura (§4.2, §5).
     */
    public async applyPayoutStatus(
        organizationId: number,
        data: Pick<Prisma.OrganizationUpdateInput, "payoutStatus" | "stripeAccountId">,
        tx?: Prisma.TransactionClient,
    ): Promise<Organization> {
        Log.info(`[Organization Service]: applying payout status to organization (id ${organizationId})`);
        return this.organizationRepository.update(
            { id: organizationId },
            { ...data, payoutCheckedAt: new Date() },
            undefined,
            undefined,
            tx,
        );
    }

    private async findByIdOrThrow(principalId: number, id: number): Promise<Organization> {
        const organization = await this.findById(principalId, id);
        if (!organization) {
            Log.warn(`[Organization Service]: organization (id ${id}) not found in the caller's scope`);
            throw new httpErrors.NotFound("Organizzazione non trovata.");
        }
        return organization;
    }

    private createQueryFromPayload(payload: OrganizationQueryDTO): Prisma.OrganizationWhereInput {
        const valueQuery: Prisma.OrganizationWhereInput[] = [
            createObjectWithoutThrow(payload.value, { name: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { legalName: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { vatNumber: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { contactEmail: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.OrganizationWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(payload.status?.length, { status: { in: payload.status } }),
            createObjectWithoutThrow(payload.payoutStatus?.length, { payoutStatus: { in: payload.payoutStatus } }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
