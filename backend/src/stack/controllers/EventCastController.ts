import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { EventCastService } from "@services/EventCastService";
import { EventCastCreateDTO, EventCastCreateSchema } from "@DTOs/event_cast/EventCastCreateDTO";
import { EventCastUpdateDTO, EventCastUpdateSchema } from "@DTOs/event_cast/EventCastUpdateDTO";
import { EventCastPaginateBodyInputSchema, EventCastPaginateDTO } from "@DTOs/event_cast/EventCastQueryDTO";

/**
 * Cast dell'evento (§4.6) — tutte le rotte sono `#OWN` (§3.8): la terna dichiarata è quella
 * canonica del dialetto, l'isolamento fra organizzazioni lo realizza il filtro
 * obbligatorio nei finder di repository (§1.5, nota 8 del §3.10).
 */
@Controller({
    route: "/event-casts",
    tags: [{ name: "EventCasts", description: "EventCast management" }],
})
export class EventCastController {
    constructor(private readonly eventCastService: EventCastService) {}

    @POST("/create", {
        schema: {
            operationId: "createEventCast",
            summary: "Create EventCast",
            description: "Creates a new EventCast inside the caller's organization scope.",
            body: EventCastCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.EVENT_CAST, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: EventCastCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventCastService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findEventCast",
            summary: "Get EventCast from id",
            description: "Returns a single EventCast by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT_CAST, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.eventCastService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateEventCast",
            summary: "Paginate EventCast",
            description: "Returns a filtered and paginated list of EventCast, restricted to the caller's scope.",
            body: EventCastPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT_CAST, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: EventCastPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as EventCastPaginateDTO;
        reply.status(200).send(await this.eventCastService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateEventCast",
            summary: "Update EventCast from id",
            description: "Partially updates the EventCast's own scalar fields.",
            params: exz.pathId,
            body: EventCastUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.EVENT_CAST, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: EventCastUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventCastService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteEventCast",
            summary: "Delete EventCast by id",
            description: "Soft deletes the EventCast.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.EVENT_CAST, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventCastService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
