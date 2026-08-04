import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { EventRequirementService } from "@services/EventRequirementService";
import { EventRequirementCreateDTO, EventRequirementCreateSchema } from "@DTOs/event_requirement/EventRequirementCreateDTO";
import { EventRequirementUpdateDTO, EventRequirementUpdateSchema } from "@DTOs/event_requirement/EventRequirementUpdateDTO";
import { EventRequirementPaginateBodyInputSchema, EventRequirementPaginateDTO } from "@DTOs/event_requirement/EventRequirementQueryDTO";

/**
 * Requisiti di partecipazione (§4.6) — tutte le rotte sono `#OWN` (§3.8): la terna dichiarata è quella
 * canonica del dialetto, l'isolamento fra organizzazioni lo realizza il filtro
 * obbligatorio nei finder di repository (§1.5, nota 8 del §3.10).
 */
@Controller({
    route: "/event-requirements",
    tags: [{ name: "EventRequirements", description: "EventRequirement management" }],
})
export class EventRequirementController {
    constructor(private readonly eventRequirementService: EventRequirementService) {}

    @POST("/create", {
        schema: {
            operationId: "createEventRequirement",
            summary: "Create EventRequirement",
            description: "Creates a new EventRequirement inside the caller's organization scope.",
            body: EventRequirementCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.EVENT_REQUIREMENT, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: EventRequirementCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventRequirementService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findEventRequirement",
            summary: "Get EventRequirement from id",
            description: "Returns a single EventRequirement by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT_REQUIREMENT, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.eventRequirementService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateEventRequirement",
            summary: "Paginate EventRequirement",
            description: "Returns a filtered and paginated list of EventRequirement, restricted to the caller's scope.",
            body: EventRequirementPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT_REQUIREMENT, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: EventRequirementPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as EventRequirementPaginateDTO;
        reply.status(200).send(await this.eventRequirementService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateEventRequirement",
            summary: "Update EventRequirement from id",
            description: "Partially updates the EventRequirement's own scalar fields.",
            params: exz.pathId,
            body: EventRequirementUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.EVENT_REQUIREMENT, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: EventRequirementUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventRequirementService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteEventRequirement",
            summary: "Delete EventRequirement by id",
            description: "Soft deletes the EventRequirement.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.EVENT_REQUIREMENT, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventRequirementService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
