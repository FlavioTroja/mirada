import { Service } from "fastify-decorators";
import { OrgMemberRole, Organization, Prisma, User } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { getPrismaClient } from "@utils/adapters/prisma";
import { isGod } from "@utils/adapters/permission";
import { OrganizationRepository } from "@repositories/OrganizationRepository";
import { OrganizationMemberRepository } from "@repositories/OrganizationMemberRepository";
import { UserRepository } from "@repositories/UserRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { OrganizationMemberService } from "@services/OrganizationMemberService";
import { OrganizationCreateDTO } from "@DTOs/organization/OrganizationCreateDTO";
import { OrganizationUpdateDTO } from "@DTOs/organization/OrganizationUpdateDTO";
import { OrganizationQueryDTO } from "@DTOs/organization/OrganizationQueryDTO";

@Service()
export class OrganizationService {
    constructor(
        private readonly organizationRepository: OrganizationRepository,
        private readonly organizationMemberRepository: OrganizationMemberRepository,
        private readonly userRepository: UserRepository,
        private readonly organizationMemberService: OrganizationMemberService,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    /**
     * **L'apertura di un cliente della piattaforma** — §4.2.
     *
     * Nel primo taglio le organizzazioni sono create a mano dal Super Admin: non
     * esiste coda di approvazione self-service. Ma «creata da `GOD`» non vuol
     * dire «di `GOD`», ed è la distinzione su cui l'intero impianto multi-cliente
     * si regge.
     *
     * ── Perché in una transazione sola, e non in tre passaggi ─────────────────
     * Per essere un organizzatore operativo servono **tre** fatti, e ciascuno
     * senza gli altri non serve a niente:
     *
     *  1. l'`Organization`;
     *  2. l'`OrganizationMember` con ruolo `OWNER` — lo scope `#OWN` del §1.5 si
     *     realizza sulle membership, e senza di essa l'organizzazione è
     *     irraggiungibile: nessuno la vede, e `OrganizationAudienceService` non
     *     trova un `wsCode` a cui mandare i segnali del §3.9;
     *  3. il `RoleToUser` con `RoleName.OWNER` — perché `OrgMemberRole` e
     *     `RoleName` sono **due enum distinti con gli stessi nomi**: la
     *     membership dice *di quale* organizzazione fai parte, il ruolo dice
     *     *cosa* ti è permesso. Una persona con la sola membership è titolare di
     *     un'organizzazione su cui non può fare nulla.
     *
     * Erano tre passaggi manuali che nessuno legava, e dimenticarne uno produceva
     * un cliente a metà — silenziosamente, perché ogni passaggio riesce da solo.
     * Qui o si aprono tutti e tre, o non si apre niente.
     */
    public async save(principalId: number, dto: OrganizationCreateDTO): Promise<Organization> {
        const { ownerUserId, ...data } = dto;
        const owner = await this.resolveOwner(principalId, ownerUserId);

        Log.info(
            `[Organization Service]: creating organization '${dto.name}' `
            + `for owner (id ${owner.id}) on behalf of user (id ${principalId})`,
        );

        const organization = await getPrismaClient().$transaction(async prisma => {
            const created = await this.organizationRepository.save(data, prisma);

            await this.organizationMemberRepository.save(
                {
                    organizationId: created.id,
                    userId: owner.id,
                    role: OrgMemberRole.OWNER,
                    invitedAt: new Date(),
                    // Non c'è invito da accettare: il titolare è designato
                    // all'apertura, non invitato dopo.
                    acceptedAt: new Date(),
                },
                prisma,
            );

            // Il ruolo lo concede `OrganizationMemberService`, che è il solo
            // posto che sa come membership e ruoli si legano — e che lo fa per
            // riconciliazione, quindi è già idempotente: chi possiede un'altra
            // organizzazione è `OWNER` da prima, e il vincolo di unicità su
            // (roleName, userId) farebbe fallire un inserimento cieco,
            // portandosi dietro l'intera transazione.
            await this.organizationMemberService.syncMembershipRoles(owner.id, prisma);

            return created;
        });

        Log.info(
            `[Organization Service]: organization created '${organization.name}' (id ${organization.id}) `
            + `with user '${owner.username}' (id ${owner.id}) as OWNER`,
        );
        return organization;
    }

    /**
     * Chi sarà il titolare.
     *
     * Se il campo arriva, è quello — dopo aver verificato che l'utente esista e
     * sia attivo: designare un titolare inesistente aprirebbe un'organizzazione
     * che nessuno può amministrare, esattamente il difetto che questo metodo
     * esiste per impedire.
     *
     * Se non arriva, ricade sul creatore — **tranne quando il creatore è `GOD`**.
     * Il Super Admin apre le organizzazioni per conto di altri: lasciarlo
     * diventare proprietario per omissione lo renderebbe membro di ogni cliente
     * della piattaforma, e gli recapiterebbe i segnali in tempo reale di tutti.
     * La ricaduta resta corretta il giorno in cui un organizzatore si registrerà
     * da sé, ed è per quel giorno che è scritta.
     */
    private async resolveOwner(principalId: number, ownerUserId?: number): Promise<User> {
        if (ownerUserId === undefined) {
            if (await isGod(principalId)) {
                Log.warn(
                    `[Organization Service]: refused to create an organization without a designated owner `
                    + `(requested by GOD user id ${principalId})`,
                );
                throw new httpErrors.BadRequest(
                    "Indica l'utente che sarà titolare dell'organizzazione: il Super Admin la apre per conto di altri, non per sé.",
                );
            }
            ownerUserId = principalId;
        }

        const owner = await this.userRepository.findOne({ id: ownerUserId, deleted: false, enabled: true });
        if (!owner) {
            Log.warn(`[Organization Service]: designated owner (id ${ownerUserId}) not found or not enabled`);
            throw new httpErrors.BadRequest("L'utente indicato come titolare non esiste o non è attivo.");
        }
        return owner;
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
