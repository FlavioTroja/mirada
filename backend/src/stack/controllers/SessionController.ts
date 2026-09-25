import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { SessionService } from "@services/SessionService";
import { SessionCreateDTO, SessionCreateSchema } from "@DTOs/session/SessionCreateDTO";
import { SessionUpdateDTO, SessionUpdateSchema } from "@DTOs/session/SessionUpdateDTO";
import { SessionCancelDTO, SessionCancelSchema } from "@DTOs/session/SessionCancelDTO";
import { SessionPaginateBodyInputSchema, SessionPaginateDTO } from "@DTOs/session/SessionQueryDTO";
import { SessionScheduleDTO, SessionScheduleSchema } from "@DTOs/session/SessionScheduleDTO";
import { SessionSeriesUpdateDTO, SessionSeriesUpdateSchema } from "@DTOs/session/SessionSeriesUpdateDTO";
import { SeriesScopeQueryDTO, SeriesScopeQuerySchema } from "@DTOs/calendar/SeriesScopeDTO";
import { CalendarRangeDTO, CalendarRangeSchema } from "@DTOs/calendar/CalendarRangeDTO";

/**
 * Sessioni dell'evento (§4.6) — tutte le rotte sono `#OWN` (§3.8): la terna dichiarata è quella
 * canonica del dialetto, l'isolamento fra organizzazioni lo realizza il filtro
 * obbligatorio nei finder di repository (§1.5, nota 8 del §3.10).
 */
@Controller({
    route: "/sessions",
    tags: [{ name: "Sessions", description: "Session management" }],
})
export class SessionController {
    constructor(private readonly sessionService: SessionService) {}

    @POST("/create", {
        schema: {
            operationId: "createSession",
            summary: "Create Session",
            description: "Creates a new Session inside the caller's organization scope.",
            body: SessionCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.SESSION, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: SessionCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.sessionService.save(+req.user.id, req.body));
    }

    @POST("/schedule", {
        schema: {
            operationId: "scheduleSessions",
            summary: "Schedule Sessions from the calendar",
            description: "Creates one session or a weekly series (recurrence: weekdays + until or count, computed in local time so DST never shifts the clock). New course lessons join every ticket type that already covered all the course's live lessons; the response lists them. OPEN_DAY is accepted only on courses. At most 104 occurrences.",
            body: SessionScheduleSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.SESSION, PermissionScope.ALL),
        ],
    })
    async schedule(
        req: FastifyRequest<{ Body: SessionScheduleDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.sessionService.schedule(+req.user.id, req.body));
    }

    @POST("/calendar", {
        schema: {
            operationId: "findSessionsCalendar",
            summary: "Sessions in a calendar period",
            description: "Sessions of every family (course lessons, open days, festival and milonga sessions, cancelled ones included) that overlap [from, to), with their event's title, status, venue and family. At most 45 days per call.",
            body: CalendarRangeSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.SESSION, PermissionScope.ALL),
        ],
    })
    async calendar(
        req: FastifyRequest<{ Body: CalendarRangeDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.sessionService.findCalendar(+req.user.id, req.body));
    }

    @PATCH("/:id/series", {
        schema: {
            operationId: "updateSessionSeries",
            summary: "Update a Session series",
            description: "Applies the change to this occurrence and the following ones (FOLLOWING) or to the whole series (ALL). New times are those of this occurrence: each occurrence keeps its own day and gets the same clock time and duration. Moving the day is refused.",
            params: exz.pathId,
            body: SessionSeriesUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.SESSION, PermissionScope.SINGLE),
        ],
    })
    async updateSeries(
        req: FastifyRequest<{ Params: { id: string }, Body: SessionSeriesUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.sessionService.updateSeries(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id/series", {
        schema: {
            operationId: "deleteSessionSeries",
            summary: "Delete a Session series",
            description: "Soft-deletes this occurrence and the following ones (FOLLOWING) or the whole series (ALL). Occurrences already over, and those with at least one check-in, are skipped; the response counts them.",
            params: exz.pathId,
            querystring: SeriesScopeQuerySchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.SESSION, PermissionScope.SINGLE),
        ],
    })
    async deleteSeries(
        req: FastifyRequest<{ Params: { id: string }, Querystring: SeriesScopeQueryDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.sessionService.deleteSeries(+req.user.id, +req.params.id, req.query.scope));
    }

    @GET("/:id", {
        schema: {
            operationId: "findSession",
            summary: "Get Session from id",
            description: "Returns a single Session by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.SESSION, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.sessionService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateSession",
            summary: "Paginate Session",
            description: "Returns a filtered and paginated list of Session, restricted to the caller's scope.",
            body: SessionPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.SESSION, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: SessionPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as SessionPaginateDTO;
        reply.status(200).send(await this.sessionService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateSession",
            summary: "Update Session from id",
            description: "Partially updates the Session's own scalar fields.",
            params: exz.pathId,
            body: SessionUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.SESSION, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: SessionUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.sessionService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteSession",
            summary: "Delete Session by id",
            description: "Soft deletes the Session.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.SESSION, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.sessionService.safeDeleteById(+req.user.id, +req.params.id));
    }

    /**
     * `POST /sessions/:id/cancel` — §3.7, `RF-EVT-35` e `RF-EVT-36`.
     *
     * Annullamento di **una singola sessione** su un evento che si svolge
     * regolarmente. Rilascia le quote di quella sessione e restituisce i titoli
     * che la includono **con il loro peso di ripartizione**: è ciò su cui si
     * appoggiano il rimborso proporzionale e la comunicazione ai soli titolari
     * interessati, non a tutti gli iscritti.
     */
    @POST("/:id/cancel", {
        schema: {
            operationId: "cancelSession",
            summary: "Cancel a single Session",
            description: "Cancels one session of an event that otherwise takes place regularly. Releases exactly the quota consumptions of that session and returns the ticket types that include it with their allocation weight (RF-EVT-35, RF-EVT-36).",
            params: exz.pathId,
            body: SessionCancelSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.SESSION, PermissionScope.SINGLE),
        ],
    })
    async cancel(
        req: FastifyRequest<{ Params: { id: string }, Body: SessionCancelDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(
            await this.sessionService.cancelSession(+req.user.id, +req.params.id, req.body.reason),
        );
    }
}
