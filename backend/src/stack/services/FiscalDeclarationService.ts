import { Service } from "fastify-decorators";
import { FiscalDeclaration, FiscalDeclarationKind, Prisma } from "@prisma/client";
import httpErrors from "http-errors";
import { Log } from "@utils/adapters/log";
import { FindOptions, PaginateOptions } from "@utils/helpers/exz";
import { createObjectWithoutThrow } from "@utils/helpers/query";
import { PaginateDatasourceDTO } from "@DTOs/paginate/PaginateDTO";
import { FiscalDeclarationRepository } from "@repositories/FiscalDeclarationRepository";
import { OrganizationScopeService } from "@services/OrganizationScopeService";
import { FiscalDeclarationCreateDTO } from "@DTOs/fiscal_declaration/FiscalDeclarationCreateDTO";
import { FiscalDeclarationQueryDTO } from "@DTOs/fiscal_declaration/FiscalDeclarationQueryDTO";

/** Dati che il server calcola da sé e non accetta mai dal client (§4.3). */
export type FiscalDeclarationServerContext = {
    declaredByUserId: number;
    ipAddress: string;
};

/**
 * Testo dell'attestazione che accompagna la pubblicazione di un evento
 * (`RF-ORG-8`). Riproduce il posizionamento dichiarato della piattaforma: Mirada
 * è uno strumento di vendita, non un intermediario fiscale, e gli adempimenti
 * restano dell'organizzatore.
 */
export const EVENT_ATTESTATION_STATEMENT =
    "L'organizzatore attesta che gli adempimenti fiscali relativi alla vendita dei titoli di "
    + "accesso a questo evento restano integralmente a proprio carico e si svolgono fuori dalla "
    + "piattaforma. Mirada Tango è uno strumento di vendita e non emette alcun titolo fiscale.";

/**
 * §4.3 — la dichiarazione fiscale è **immutabile**: nessun aggiornamento, nessuna
 * cancellazione, si crea una nuova versione. Il servizio non espone quindi
 * `updateById` né `safeDeleteById`.
 */
@Service()
export class FiscalDeclarationService {
    constructor(
        private readonly fiscalDeclarationRepository: FiscalDeclarationRepository,
        private readonly organizationScopeService: OrganizationScopeService,
    ) {}

    public async save(
        principalId: number,
        dto: FiscalDeclarationCreateDTO,
        context: FiscalDeclarationServerContext,
    ): Promise<FiscalDeclaration> {
        const scope = await this.organizationScopeService.resolve(principalId);
        this.organizationScopeService.assertWritable(scope, dto.organizationId);

        if (dto.kind === FiscalDeclarationKind.EVENT_ATTESTATION && !dto.eventId) {
            Log.warn(`[FiscalDeclaration Service]: EVENT_ATTESTATION without an event for organization (id ${dto.organizationId})`);
            throw new httpErrors.BadRequest("Un'attestazione di evento deve indicare l'evento a cui si riferisce.");
        }

        Log.info(`[FiscalDeclaration Service]: creating ${dto.kind} declaration for organization (id ${dto.organizationId})`);
        return this.create({ ...dto, eventId: dto.eventId ?? null }, context);
    }

    /**
     * Creazione con progressivo. Accetta un `tx` perché la pubblicazione di un
     * evento (§4.5) crea l'attestazione **nella stessa transazione** della
     * transizione di stato: o valgono entrambe, o nessuna delle due.
     */
    public async create(
        input: {
            organizationId: number;
            eventId: number | null;
            kind: FiscalDeclarationKind;
            frameworkLabel: string;
            statementText: string;
        },
        context: FiscalDeclarationServerContext,
        tx?: Prisma.TransactionClient,
    ): Promise<FiscalDeclaration> {
        const latest = await this.fiscalDeclarationRepository.findLatestVersion(
            input.organizationId,
            input.kind,
            input.eventId,
            tx,
        );
        const version = (latest?.version ?? 0) + 1;

        const declaration = await this.fiscalDeclarationRepository.save(
            {
                organizationId: input.organizationId,
                eventId: input.eventId,
                kind: input.kind,
                version,
                frameworkLabel: input.frameworkLabel,
                statementText: input.statementText,
                declaredAt: new Date(),
                declaredByUserId: context.declaredByUserId,
                ipAddress: context.ipAddress,
            },
            tx,
        );

        Log.info(
            `[FiscalDeclaration Service]: declaration created (id ${declaration.id}) `
            + `kind ${declaration.kind} version ${declaration.version} by user (id ${context.declaredByUserId})`,
        );
        return declaration;
    }

    /**
     * Ultima dichiarazione di inquadramento dell'organizzazione: è la fonte della
     * `frameworkLabel` che l'attestazione di evento riporta.
     */
    public async findLatestFramework(organizationId: number, tx?: Prisma.TransactionClient): Promise<FiscalDeclaration | null> {
        return this.fiscalDeclarationRepository.findLatestVersion(
            organizationId,
            FiscalDeclarationKind.ORGANIZATION_FRAMEWORK,
            null,
            tx,
        );
    }

    public async findById(principalId: number, id: number, options?: FindOptions): Promise<FiscalDeclaration | null> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.fiscalDeclarationRepository.findOneInScope(scope, { id, deleted: false }, options);
    }

    public async paginate(
        principalId: number,
        query: FiscalDeclarationQueryDTO,
        options: PaginateOptions,
    ): Promise<PaginateDatasourceDTO<FiscalDeclaration>> {
        const scope = await this.organizationScopeService.resolve(principalId);
        return this.fiscalDeclarationRepository.paginateInScope(scope, this.createQueryFromPayload(query), options);
    }

    private createQueryFromPayload(payload: FiscalDeclarationQueryDTO): Prisma.FiscalDeclarationWhereInput {
        const valueQuery: Prisma.FiscalDeclarationWhereInput[] = [
            createObjectWithoutThrow(payload.value, { frameworkLabel: { contains: payload.value, mode: "insensitive" } }),
            createObjectWithoutThrow(payload.value, { statementText: { contains: payload.value, mode: "insensitive" } }),
        ].filter(o => Object.values(o).length > 0);

        const query: Prisma.FiscalDeclarationWhereInput[] = [
            { deleted: false },
            createObjectWithoutThrow(valueQuery.length, { OR: valueQuery }),
            createObjectWithoutThrow(payload.organizationId, { organizationId: payload.organizationId }),
            createObjectWithoutThrow(payload.eventId, { eventId: payload.eventId }),
            createObjectWithoutThrow(payload.kind, { kind: payload.kind }),
        ].filter(o => Object.values(o).length > 0);

        return { AND: query };
    }
}
