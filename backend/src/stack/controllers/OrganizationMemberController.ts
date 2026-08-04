import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { OrganizationMemberService } from "@services/OrganizationMemberService";
import { OrganizationMemberCreateDTO, OrganizationMemberCreateSchema } from "@DTOs/organization_member/OrganizationMemberCreateDTO";
import { OrganizationMemberUpdateDTO, OrganizationMemberUpdateSchema } from "@DTOs/organization_member/OrganizationMemberUpdateDTO";
import { OrganizationMemberPaginateBodyInputSchema, OrganizationMemberPaginateDTO } from "@DTOs/organization_member/OrganizationMemberQueryDTO";

/**
 * Ogni rotta porta il principale al servizio: l'isolamento fra organizzazioni
 * (§1.5) è realizzato dal filtro obbligatorio nei finder di repository, non dal
 * solo controllo di permesso.
 */
@Controller({
    route: "/organization-members",
    tags: [{ name: "OrganizationMembers", description: "OrganizationMember management" }],
})
export class OrganizationMemberController {
    constructor(private readonly organizationMemberService: OrganizationMemberService) {}

    @POST("/create", {
        schema: {
            operationId: "createOrganizationMember",
            summary: "Create OrganizationMember",
            description: "Creates a new organization member inside the caller's organization scope.",
            body: OrganizationMemberCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.ORGANIZATION_MEMBER, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: OrganizationMemberCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.organizationMemberService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findOrganizationMember",
            summary: "Get OrganizationMember from id",
            description: "Returns a single organization member by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ORGANIZATION_MEMBER, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.organizationMemberService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateOrganizationMember",
            summary: "Paginate OrganizationMember",
            description: "Returns a filtered and paginated list of organization members, restricted to the caller's scope.",
            body: OrganizationMemberPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ORGANIZATION_MEMBER, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: OrganizationMemberPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as OrganizationMemberPaginateDTO;
        reply.status(200).send(await this.organizationMemberService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateOrganizationMember",
            summary: "Update OrganizationMember from id",
            description: "Partially updates the organization member's own scalar fields.",
            params: exz.pathId,
            body: OrganizationMemberUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.ORGANIZATION_MEMBER, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: OrganizationMemberUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.organizationMemberService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteOrganizationMember",
            summary: "Delete OrganizationMember by id",
            description: "Soft deletes the organization member.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.ORGANIZATION_MEMBER, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.organizationMemberService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
