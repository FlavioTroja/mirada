import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { ProspectService } from "@services/ProspectService";
import { ProspectCreateDTO, ProspectCreateSchema } from "@DTOs/prospect/ProspectCreateDTO";
import { ProspectUpdateDTO, ProspectUpdateSchema } from "@DTOs/prospect/ProspectUpdateDTO";
import { ProspectPaginateBodyInputSchema, ProspectPaginateDTO } from "@DTOs/prospect/ProspectQueryDTO";
import { ProspectMarkContactedDTO, ProspectMarkContactedSchema } from "@DTOs/prospect/ProspectMarkContactedDTO";

/**
 * I prospect dell'open day — `19-prospect.md`. L'isolamento fra organizzazioni
 * sta nei finder di repository (§1.5), non nel solo controllo di permesso.
 */
@Controller({
    route: "/prospects",
    tags: [{ name: "Prospects", description: "Open-day prospects of a school" }],
})
export class ProspectController {
    constructor(private readonly prospectService: ProspectService) {}

    @POST("/create", {
        schema: {
            operationId: "createProspect",
            summary: "Create Prospect",
            description: "Records someone who attended a course's open day without enrolling. The organization is derived from the course; consent to be contacted is mandatory, and at least one of email or phone.",
            body: ProspectCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.PROSPECT, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: ProspectCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.prospectService.save(+req.user.id, req.body));
    }

    @POST("/mark-contacted", {
        schema: {
            operationId: "markProspectsContacted",
            summary: "Mark Prospects as contacted",
            description: "Sets status CONTACTED and contactedAt on every listed prospect. All ids must be in the caller's scope, or nothing is written.",
            body: ProspectMarkContactedSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.PROSPECT, PermissionScope.SINGLE),
        ],
    })
    async markContacted(
        req: FastifyRequest<{ Body: ProspectMarkContactedDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.prospectService.markContacted(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findProspect",
            summary: "Get Prospect from id",
            description: "Returns a single prospect by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.PROSPECT, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.prospectService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateProspect",
            summary: "Paginate Prospect",
            description: "Returns a filtered and paginated list of prospects, restricted to the caller's scope. Prospects who have since enrolled are recognised by email before the list is read.",
            body: ProspectPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.PROSPECT, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: ProspectPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as ProspectPaginateDTO;
        reply.status(200).send(await this.prospectService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateProspect",
            summary: "Update Prospect from id",
            description: "Partially updates the prospect's own scalar fields, status included.",
            params: exz.pathId,
            body: ProspectUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.PROSPECT, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: ProspectUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.prospectService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteProspect",
            summary: "Delete Prospect by id",
            description: "Permanently deletes the prospect: it is personal data, and a removal request must remove it.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.PROSPECT, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.prospectService.deleteById(+req.user.id, +req.params.id));
    }
}
