import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { OrganizationService } from "@services/OrganizationService";
import { OrganizationCreateDTO, OrganizationCreateSchema } from "@DTOs/organization/OrganizationCreateDTO";
import { OrganizationUpdateDTO, OrganizationUpdateSchema } from "@DTOs/organization/OrganizationUpdateDTO";
import {
    OrganizationPaginateBodyInputSchema,
    OrganizationPaginateDTO,
} from "@DTOs/organization/OrganizationQueryDTO";

/**
 * Nel primo taglio le organizzazioni sono create a mano: nessuna coda di
 * approvazione self-service (§4.2). La creazione non è concessa ad alcun ruolo
 * della matrice §3.8, quindi passa il solo `GOD` (allow-all implicito).
 */
@Controller({
    route: "/organizations",
    tags: [{ name: "Organizations", description: "Organization management" }],
})
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {}

    @POST("/create", {
        schema: {
            operationId: "createOrganization",
            summary: "Create Organization",
            description: "Creates a new organization. Reserved to the platform Super Admin.",
            body: OrganizationCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.ORGANIZATION, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: OrganizationCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.organizationService.save(req.body));
    }

    @GET("/:id/payout-status", {
        schema: {
            operationId: "findOrganizationPayoutStatus",
            summary: "Get Organization payout status",
            description: "Returns the stored Stripe payout state of the organization (RF-ORG-12).",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ORGANIZATION, PermissionScope.OWN),
        ],
    })
    async getPayoutStatus(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.organizationService.findPayoutStatus(+req.user.id, +req.params.id));
    }

    @GET("/:id", {
        schema: {
            operationId: "findOrganization",
            summary: "Get Organization from id",
            description: "Returns a single organization by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ORGANIZATION, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const organization = await this.organizationService.findById(+req.user.id, +req.params.id, req.query);
        if (!organization) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(organization);
    }

    @POST("/", {
        schema: {
            operationId: "paginateOrganization",
            summary: "Paginate Organization",
            description: "Returns a filtered and paginated list of organizations, restricted to the caller's scope.",
            body: OrganizationPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ORGANIZATION, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: OrganizationPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as OrganizationPaginateDTO;
        reply.status(200).send(await this.organizationService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateOrganization",
            summary: "Update Organization from id",
            description: "Partially updates the organization's own scalar fields. Payout state and Stripe account are server-computed and cannot be written here.",
            params: exz.pathId,
            body: OrganizationUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.ORGANIZATION, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: OrganizationUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.organizationService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteOrganization",
            summary: "Delete Organization by id",
            description: "Soft deletes the organization. Reserved to the platform Super Admin.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.ORGANIZATION, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.organizationService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
