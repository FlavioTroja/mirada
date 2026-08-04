import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { FiscalDeclarationService } from "@services/FiscalDeclarationService";
import { FiscalDeclarationCreateDTO, FiscalDeclarationCreateSchema } from "@DTOs/fiscal_declaration/FiscalDeclarationCreateDTO";
import {
    FiscalDeclarationPaginateBodyInputSchema,
    FiscalDeclarationPaginateDTO,
} from "@DTOs/fiscal_declaration/FiscalDeclarationQueryDTO";

/**
 * §4.3 — la dichiarazione fiscale è **immutabile**: questo controller espone
 * deliberatamente **solo** creazione e lettura. Nessun `PATCH`, nessun `DELETE`:
 * si crea una nuova versione (`RF-ORG-8`). `declaredAt`, `declaredByUserId` e
 * `ipAddress` sono calcolati dal server e non compaiono nel DTO.
 */
@Controller({
    route: "/fiscal-declarations",
    tags: [{ name: "FiscalDeclarations", description: "Immutable fiscal declarations" }],
})
export class FiscalDeclarationController {
    constructor(private readonly fiscalDeclarationService: FiscalDeclarationService) {}

    @POST("/create", {
        schema: {
            operationId: "createFiscalDeclaration",
            summary: "Create FiscalDeclaration",
            description: "Creates a new immutable fiscal declaration. The version is progressive per (organization, kind, event); declaredAt, declaredByUserId and ipAddress are computed server-side.",
            body: FiscalDeclarationCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.FISCAL_DECLARATION, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: FiscalDeclarationCreateDTO }>,
        reply: FastifyReply,
    ) {
        const result = await this.fiscalDeclarationService.save(+req.user.id, req.body, {
            declaredByUserId: +req.user.id,
            ipAddress: req.ip,
        });
        reply.status(200).send(result);
    }

    @GET("/:id", {
        schema: {
            operationId: "findFiscalDeclaration",
            summary: "Get FiscalDeclaration from id",
            description: "Returns a single fiscal declaration by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.FISCAL_DECLARATION, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.fiscalDeclarationService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateFiscalDeclaration",
            summary: "Paginate FiscalDeclaration",
            description: "Returns a filtered and paginated list of fiscal declarations, restricted to the caller's scope.",
            body: FiscalDeclarationPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.FISCAL_DECLARATION, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: FiscalDeclarationPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as FiscalDeclarationPaginateDTO;
        reply.status(200).send(await this.fiscalDeclarationService.paginate(+req.user.id, query, options));
    }
}
