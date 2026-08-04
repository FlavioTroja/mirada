import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { VenueService } from "@services/VenueService";
import { VenueCreateDTO, VenueCreateSchema } from "@DTOs/venue/VenueCreateDTO";
import { VenueUpdateDTO, VenueUpdateSchema } from "@DTOs/venue/VenueUpdateDTO";
import { VenuePaginateBodyInputSchema, VenuePaginateDTO } from "@DTOs/venue/VenueQueryDTO";

/**
 * Ogni rotta porta il principale al servizio: l'isolamento fra organizzazioni
 * (§1.5) è realizzato dal filtro obbligatorio nei finder di repository, non dal
 * solo controllo di permesso.
 */
@Controller({
    route: "/venues",
    tags: [{ name: "Venues", description: "Venue management" }],
})
export class VenueController {
    constructor(private readonly venueService: VenueService) {}

    @POST("/create", {
        schema: {
            operationId: "createVenue",
            summary: "Create Venue",
            description: "Creates a new venue inside the caller's organization scope.",
            body: VenueCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.VENUE, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: VenueCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.venueService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findVenue",
            summary: "Get Venue from id",
            description: "Returns a single venue by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.VENUE, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.venueService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateVenue",
            summary: "Paginate Venue",
            description: "Returns a filtered and paginated list of venues, restricted to the caller's scope.",
            body: VenuePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.VENUE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: VenuePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as VenuePaginateDTO;
        reply.status(200).send(await this.venueService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateVenue",
            summary: "Update Venue from id",
            description: "Partially updates the venue's own scalar fields.",
            params: exz.pathId,
            body: VenueUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.VENUE, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: VenueUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.venueService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteVenue",
            summary: "Delete Venue by id",
            description: "Soft deletes the venue.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.VENUE, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.venueService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
