import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { DancerProfileService } from "@services/DancerProfileService";
import { DancerProfileCreateDTO, DancerProfileCreateSchema } from "@DTOs/dancer_profile/DancerProfileCreateDTO";
import { DancerProfileUpdateDTO, DancerProfileUpdateSchema } from "@DTOs/dancer_profile/DancerProfileUpdateDTO";
import { DancerProfilePaginateBodyInputSchema, DancerProfilePaginateDTO } from "@DTOs/dancer_profile/DancerProfileQueryDTO";

/**
 * Ogni rotta porta il principale al servizio: l'isolamento fra organizzazioni
 * (§1.5) è realizzato dal filtro obbligatorio nei finder di repository, non dal
 * solo controllo di permesso.
 */
@Controller({
    route: "/dancer-profiles",
    tags: [{ name: "DancerProfiles", description: "DancerProfile management" }],
})
export class DancerProfileController {
    constructor(private readonly dancerProfileService: DancerProfileService) {}

    @POST("/create", {
        schema: {
            operationId: "createDancerProfile",
            summary: "Create DancerProfile",
            description: "Creates a new dancer profile inside the caller's organization scope.",
            body: DancerProfileCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.DANCER_PROFILE, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: DancerProfileCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.dancerProfileService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findDancerProfile",
            summary: "Get DancerProfile from id",
            description: "Returns a single dancer profile by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.DANCER_PROFILE, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.dancerProfileService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateDancerProfile",
            summary: "Paginate DancerProfile",
            description: "Returns a filtered and paginated list of dancer profiles, restricted to the caller's scope.",
            body: DancerProfilePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.DANCER_PROFILE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: DancerProfilePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as DancerProfilePaginateDTO;
        reply.status(200).send(await this.dancerProfileService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateDancerProfile",
            summary: "Update DancerProfile from id",
            description: "Partially updates the dancer profile's own scalar fields.",
            params: exz.pathId,
            body: DancerProfileUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.DANCER_PROFILE, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: DancerProfileUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.dancerProfileService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteDancerProfile",
            summary: "Delete DancerProfile by id",
            description: "Soft deletes the dancer profile.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.DANCER_PROFILE, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.dancerProfileService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
