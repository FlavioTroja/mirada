import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { EventServiceService } from "@services/EventServiceService";
import { EventServiceCreateDTO, EventServiceCreateSchema } from "@DTOs/event_service/EventServiceCreateDTO";
import { EventServiceUpdateDTO, EventServiceUpdateSchema } from "@DTOs/event_service/EventServiceUpdateDTO";
import { EventServicePaginateBodyInputSchema, EventServicePaginateDTO } from "@DTOs/event_service/EventServiceQueryDTO";

/**
 * Servizi accessori dell'evento (§4.6) — tutte le rotte sono `#OWN` (§3.8): la terna dichiarata è quella
 * canonica del dialetto, l'isolamento fra organizzazioni lo realizza il filtro
 * obbligatorio nei finder di repository (§1.5, nota 8 del §3.10).
 */
@Controller({
    route: "/event-services",
    tags: [{ name: "EventServices", description: "EventService management" }],
})
export class EventServiceController {
    constructor(private readonly eventServiceService: EventServiceService) {}

    @POST("/create", {
        schema: {
            operationId: "createEventService",
            summary: "Create EventService",
            description: "Creates a new EventService inside the caller's organization scope.",
            body: EventServiceCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.EVENT_SERVICE, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: EventServiceCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventServiceService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findEventService",
            summary: "Get EventService from id",
            description: "Returns a single EventService by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT_SERVICE, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.eventServiceService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateEventService",
            summary: "Paginate EventService",
            description: "Returns a filtered and paginated list of EventService, restricted to the caller's scope.",
            body: EventServicePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT_SERVICE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: EventServicePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as EventServicePaginateDTO;
        reply.status(200).send(await this.eventServiceService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateEventService",
            summary: "Update EventService from id",
            description: "Partially updates the EventService's own scalar fields.",
            params: exz.pathId,
            body: EventServiceUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.EVENT_SERVICE, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: EventServiceUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventServiceService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteEventService",
            summary: "Delete EventService by id",
            description: "Soft deletes the EventService.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.EVENT_SERVICE, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventServiceService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
