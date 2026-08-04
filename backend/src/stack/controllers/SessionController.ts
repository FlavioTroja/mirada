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
