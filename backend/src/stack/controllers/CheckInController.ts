import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { CheckInService } from "@services/CheckInService";
import { CheckInCreateDTO, CheckInCreateSchema, CheckInSyncDTO, CheckInSyncSchema } from "@DTOs/check_in/CheckInCreateDTO";
import { CheckInUpdateDTO, CheckInUpdateSchema } from "@DTOs/check_in/CheckInUpdateDTO";
import { CheckInPaginateBodyInputSchema, CheckInPaginateDTO } from "@DTOs/check_in/CheckInQueryDTO";

/**
 * `CheckIn` — §4.13.
 *
 * La cella `CHECK_IN` del §3.8 concede `CREATE`/`READ`/`UPDATE#OWN` al
 * `CHECKIN_OPERATOR` e `∀#OWN` a `OWNER` ed `EVENT_MANAGER`. Il `DANCER` **non ha
 * alcun accesso**: le presenze in sala non sono un dato del partecipante.
 */
@Controller({
    route: "/check-ins",
    tags: [{ name: "CheckIns", description: "Door entries, offline sync and conflicts" }],
})
export class CheckInController {
    constructor(private readonly checkInService: CheckInService) {}

    @POST("/create", {
        schema: {
            operationId: "createCheckIn",
            summary: "Register an entry",
            description: "Registers an online entry on the ticket-session pair. RB7: a second entry on the same pair is refused with 409 carrying time and station of the first — with network the operator sees the outcome immediately. The conflict row is the correct answer only during sync, where both entries already happened. RB19: this does NOT consume capacity, and it does NOT change the ticket status.",
            body: CheckInCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.CHECK_IN, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: CheckInCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.checkInService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findCheckIn",
            summary: "Get CheckIn from id",
            description: "Returns a single check-in by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.CHECK_IN, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.checkInService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateCheckIn",
            summary: "Paginate CheckIn",
            description: "Returns a filtered and paginated list of check-ins, restricted to the caller's scope. `conflictsOnly` returns the open conflicts, which is the queue of /check-in/conflicts; revoked entries are excluded unless `includeRevoked` is set.",
            body: CheckInPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.CHECK_IN, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: CheckInPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as CheckInPaginateDTO;
        reply.status(200).send(await this.checkInService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateCheckIn",
            summary: "Update CheckIn from id",
            description: "Updates the kind of the entry. `revokedAt` is not writable here: cancelling a wrong entry has its own endpoint (POST /check-ins/:id/revoke, RF-CHK-9).",
            params: exz.pathId,
            body: CheckInUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.CHECK_IN, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: CheckInUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.checkInService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteCheckIn",
            summary: "Delete CheckIn by id",
            description: "Soft deletes the check-in. To cancel a wrong entry prefer POST /check-ins/:id/revoke, which keeps the fact readable and lets the ticket enter that session again.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.CHECK_IN, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.checkInService.safeDeleteById(+req.user.id, +req.params.id));
    }

    // ─── Non-CRUD del §3.7 ───────────────────────────────────────────────────

    @POST("/sync", {
        schema: {
            operationId: "syncCheckIns",
            summary: "Synchronise the offline queue",
            description: "Receives the local queue and returns { accepted[], conflicts[], rejected[] }. RF-CHK-6: double entries detected during sync are RETURNED AS CONFLICTS TO RESOLVE, never resolved silently — the second row is created with conflictWithId set and left to the staff in /check-in/conflicts. Replays of the very same scan (same ticket, session, device and scan instant) come back as accepted without creating a row.",
            body: CheckInSyncSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.CHECK_IN, PermissionScope.ALL),
        ],
    })
    async sync(
        req: FastifyRequest<{ Body: CheckInSyncDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.checkInService.sync(+req.user.id, req.body));
    }

    @POST("/:id/revoke", {
        schema: {
            operationId: "revokeCheckIn",
            summary: "Cancel a wrong entry",
            description: "RF-CHK-9. Does not delete the row: marks it revoked, so the entry stays readable as a fact and corrected. Leaving the partial unique index, the ticket may enter that session again — which is exactly what is needed after a mistaken scan. It is also how a sync conflict is resolved: revoke the row you discard.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.CHECK_IN, PermissionScope.SINGLE),
        ],
    })
    async revoke(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.checkInService.revoke(+req.user.id, +req.params.id));
    }
}
