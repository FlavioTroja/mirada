import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { EventService } from "@services/EventService";
import { EventDashboardService } from "@services/EventDashboardService";
import { EventExportService } from "@services/EventExportService";
import { EventExportRequestDTO, EventExportRequestSchema } from "@DTOs/event/EventExportDTO";
import { EventCreateDTO, EventCreateSchema } from "@DTOs/event/EventCreateDTO";
import { EventUpdateDTO, EventUpdateSchema } from "@DTOs/event/EventUpdateDTO";
import { EventPaginateBodyInputSchema, EventPaginateDTO } from "@DTOs/event/EventQueryDTO";
import {
    EventCancelDTO,
    EventCancelSchema,
    OrphanSessionsResolveDTO,
    OrphanSessionsResolveSchema,
} from "@DTOs/event/EventLifecycleDTO";

/**
 * Tutte le rotte sono `#OWN` (§4.5): il permesso dichiara la terna canonica del
 * dialetto, l'isolamento fra organizzazioni lo realizza il filtro `organizationId`
 * obbligatorio nei finder (§1.5, nota 8 del §3.10).
 *
 * Gli endpoint pubblici `/api/public/events/*` stanno in `PublicController`,
 * perché sono senza autenticazione.
 */
@Controller({
    route: "/events",
    tags: [{ name: "Events", description: "Event management" }],
})
export class EventController {
    constructor(
        private readonly eventService: EventService,
        private readonly eventDashboardService: EventDashboardService,
        private readonly eventExportService: EventExportService,
    ) {}

    @POST("/create", {
        schema: {
            operationId: "createEvent",
            summary: "Create Event",
            description: "Creates a new event in DRAFT status. When the event type has capMultiSession = false, an implicit session is created with it.",
            body: EventCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.EVENT, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: EventCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findEvent",
            summary: "Get Event from id",
            description: "Returns a single event by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.eventService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateEvent",
            summary: "Paginate Event",
            description: "Returns a filtered and paginated list of events, restricted to the caller's scope.",
            body: EventPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: EventPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as EventPaginateDTO;
        reply.status(200).send(await this.eventService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateEvent",
            summary: "Update Event from id",
            description: "Partially updates the event's own scalar fields. The lifecycle fields are governed by the dedicated endpoints.",
            params: exz.pathId,
            body: EventUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.EVENT, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: EventUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteEvent",
            summary: "Delete Event by id",
            description: "Soft deletes the event.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.EVENT, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventService.safeDeleteById(+req.user.id, +req.params.id));
    }

    // ─── Ciclo di vita (§3.7) ────────────────────────────────────────────────

    @POST("/:id/publish", {
        schema: {
            operationId: "publishEvent",
            summary: "Publish Event",
            description: "Publishes the event after checking RB13 — the organization must be APPROVED and payout ENABLED — and registers the EVENT_ATTESTATION fiscal declaration in the name of the acting user.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.EVENT, PermissionScope.SINGLE),
        ],
    })
    async publish(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        const result = await this.eventService.publish(+req.user.id, +req.params.id, {
            declaredByUserId: +req.user.id,
            ipAddress: req.ip,
        });
        reply.status(200).send(result);
    }

    @POST("/:id/close-sales", {
        schema: {
            operationId: "closeEventSales",
            summary: "Close Event online sales",
            description: "Closes online sales only. Manual pass issuance and external sales remain possible (RB20).",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.EVENT, PermissionScope.SINGLE),
        ],
    })
    async closeSales(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventService.closeSales(+req.user.id, +req.params.id));
    }

    @POST("/:id/reopen-sales", {
        schema: {
            operationId: "reopenEventSales",
            summary: "Reopen Event online sales",
            description: "Reopens online sales while the event has not started yet (RF-EVT-40).",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.EVENT, PermissionScope.SINGLE),
        ],
    })
    async reopenSales(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventService.reopenSales(+req.user.id, +req.params.id));
    }

    @POST("/:id/cancel", {
        schema: {
            operationId: "cancelEvent",
            summary: "Cancel Event",
            description: "Cancels the event with a mandatory reason (RF-EVT-41).",
            params: exz.pathId,
            body: EventCancelSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.EVENT, PermissionScope.SINGLE),
        ],
    })
    async cancel(
        req: FastifyRequest<{ Params: { id: string }, Body: EventCancelDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventService.cancel(+req.user.id, +req.params.id, req.body));
    }

    @POST("/:id/duplicate", {
        schema: {
            operationId: "duplicateEvent",
            summary: "Duplicate Event",
            description: "Creates a new DRAFT edition cloning sessions, cast, requirements, services, ticket types and price tiers, with sales and registrations reset (RF-EVT-16).",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.EVENT, PermissionScope.ALL),
        ],
    })
    async duplicate(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventService.duplicate(+req.user.id, +req.params.id));
    }

    @POST("/:id/orphan-sessions/resolve", {
        schema: {
            operationId: "resolveEventOrphanSessions",
            summary: "Resolve orphan sessions",
            description: "Returns the ticket types that do not include the given session, telling sold ones apart from unsold ones (RF-EVT-24).",
            params: exz.pathId,
            body: OrphanSessionsResolveSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT, PermissionScope.SINGLE),
        ],
    })
    async resolveOrphanSessions(
        req: FastifyRequest<{ Params: { id: string }, Body: OrphanSessionsResolveDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventService.resolveOrphanSessions(+req.user.id, +req.params.id, req.body));
    }

    @GET("/:id/dashboard", {
        schema: {
            operationId: "getEventDashboard",
            summary: "Back-office dashboard of an event",
            description: "Registrations by role with the current imbalance and the configured tolerance, complete couples, capacity, committed units per ticket type and per service, configured requirements and the registration trend (RF-BKO-1, RF-CPL-11). Every section declares the entities it is computed on (RB21); the sections that would need Order, Payment, Ticket, CheckIn or RequirementOutcome are returned as available:false with the reason, never zeroed in silence.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT, PermissionScope.SINGLE),
        ],
    })
    async dashboard(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventDashboardService.build(+req.user.id, +req.params.id));
    }

    @POST("/:id/exports", {
        schema: {
            operationId: "createEventExport",
            summary: "Produce a back-office export of an event",
            description: "Produces an export file and returns its fileUrl (RF-BKO-3, RF-BKO-9). kind ∈ { REGISTRATIONS, ORDERS, REVENUE, ATTENDANCE, SALES_BY_SESSION }. The kinds that depend on entities not yet built fail with 501 and an explicit message: an empty file that looks like data would be worse than an error — SALES_BY_SESSION in particular is RF-BKO-9, one of the three conditions holding up the platform's fiscal positioning.",
            params: exz.pathId,
            body: EventExportRequestSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EVENT, PermissionScope.SINGLE),
        ],
    })
    async createExport(
        req: FastifyRequest<{ Params: { id: string }, Body: EventExportRequestDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.eventExportService.export(+req.user.id, +req.params.id, req.body));
    }
}
