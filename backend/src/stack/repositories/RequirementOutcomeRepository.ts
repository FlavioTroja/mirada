import { Service } from "fastify-decorators";
import { Prisma, RequirementOutcome, RequirementOutcomeStatus } from "@prisma/client";
import { BaseRepository } from "@repositories/BaseRepository";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { OrganizationScope } from "@utils/helpers/organizationScope";

/** Esiti che **non** consentono l'ingresso su un requisito bloccante (`RF-CHK-4`, `RF-REQ-7`). */
export const BLOCKING_OUTCOME_STATUSES: RequirementOutcomeStatus[] = [
    RequirementOutcomeStatus.TO_PROVIDE,
    RequirementOutcomeStatus.UNDER_REVIEW,
    RequirementOutcomeStatus.REJECTED,
    RequirementOutcomeStatus.EXPIRED,
];

@Service()
export class RequirementOutcomeRepository extends BaseRepository<"requirementOutcome"> {
    constructor() {
        super("requirementOutcome");
    }

    async findByRegistration(
        registrationId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<RequirementOutcome[]> {
        return this.findMany({ registrationId, deleted: false }, { orderBy: { id: "asc" } }, tx);
    }

    async findByRegistrations(
        registrationIds: number[],
        tx?: Prisma.TransactionClient,
    ): Promise<RequirementOutcome[]> {
        if (!registrationIds.length) {
            return [];
        }
        return this.findMany(
            { registrationId: { in: registrationIds }, deleted: false },
            { orderBy: { id: "asc" } },
            tx,
        );
    }

    /** La chiave unica `(registrationId, eventRequirementId)`: un esito per requisito per iscrizione. */
    async findByRegistrationAndRequirement(
        registrationId: number,
        eventRequirementId: number,
        tx?: Prisma.TransactionClient,
    ): Promise<RequirementOutcome | null> {
        return this.findOne({ registrationId, eventRequirementId, deleted: false }, undefined, tx);
    }

    /**
     * §1.5 — lo scope passa dall'iscrizione e poi dall'evento: `RequirementOutcome`
     * non porta `organizationId`, e il permesso da solo non isola nulla.
     */
    async findOneInScope(
        scope: OrganizationScope,
        query: Prisma.RequirementOutcomeWhereInput,
        options?: FindOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<RequirementOutcome | null> {
        return this.findOne({ AND: [query, this.scopeWhere(scope)] }, options, tx);
    }

    async paginateInScope(
        scope: OrganizationScope,
        query: Prisma.RequirementOutcomeWhereInput,
        options: PaginateOptions,
        tx?: Prisma.TransactionClient,
    ): Promise<PaginateDatasourceDTO<RequirementOutcome>> {
        return this.paginate({ AND: [query, this.scopeWhere(scope)] }, options, tx);
    }

    async safeDeleteById(id: number, tx?: Prisma.TransactionClient): Promise<RequirementOutcome> {
        return this.exec(() =>
            this.getDelegate(tx).update({ where: { id }, data: { deleted: true } })
        );
    }

    private scopeWhere(scope: OrganizationScope): Prisma.RequirementOutcomeWhereInput {
        return scope === null ? {} : { registration: { event: { organizationId: { in: scope } } } };
    }
}
