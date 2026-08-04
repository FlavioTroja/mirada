import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { EventTypeService } from "@services/EventTypeService";
import { EventTypeCreateDTO, EventTypeCreateSchema } from "@DTOs/event_type/EventTypeCreateDTO";
import { EventTypeUpdateDTO, EventTypeUpdateSchema } from "@DTOs/event_type/EventTypeUpdateDTO";
import { EventTypePaginateBodyInputSchema, EventTypePaginateDTO } from "@DTOs/event_type/EventTypeQueryDTO";

/**
 * Catalogo di piattaforma (§4.1): la scrittura è riservata a `GOD`
 * (`EVERYTHING#EVENT_TYPE#EVERYTHING`), la lettura è `READ#EVENT_TYPE#ALL`
 * per ogni ruolo autenticato.
 */
@Controller({
    route: "/event-types",
    tags: [{ name: "EventTypes", description: "EventType catalogue management" }],
})
export class EventTypeController {
    constructor(private readonly eventTypeService: EventTypeService) {}

    @POST("/create", {
        schema: {
            operationId: "createEventType",
            summary: "Create EventType",
            description: "Creates a new event type. Platform catalogue, reserved to GOD.",
            body: EventTypeCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.EVERYTHING, PermissionResource.EVENT_TYPE, PermissionScope.EVERYTHING),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: EventTypeCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventTypeService.save(req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findEventType",
            summary: "Get EventType from id",
            description: "Returns a single event type by id.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT_TYPE, PermissionScope.ALL),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.eventTypeService.findById(+req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateEventType",
            summary: "Paginate EventType",
            description: "Returns a filtered and paginated list of event types.",
            body: EventTypePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT_TYPE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: EventTypePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as EventTypePaginateDTO;
        reply.status(200).send(await this.eventTypeService.paginate(query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateEventType",
            summary: "Update EventType from id",
            description: "Partially updates the event type's own scalar fields. Platform catalogue, reserved to GOD.",
            params: exz.pathId,
            body: EventTypeUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.EVERYTHING, PermissionResource.EVENT_TYPE, PermissionScope.EVERYTHING),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: EventTypeUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventTypeService.updateById(+req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteEventType",
            summary: "Delete EventType by id",
            description: "Soft deletes the event type. Platform catalogue, reserved to GOD.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.EVERYTHING, PermissionResource.EVENT_TYPE, PermissionScope.EVERYTHING),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventTypeService.safeDeleteById(+req.params.id));
    }
}
