import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { RegistrationService } from "@services/RegistrationService";
import { RegistrationCreateDTO, RegistrationCreateSchema } from "@DTOs/registration/RegistrationCreateDTO";
import { RegistrationUpdateDTO, RegistrationUpdateSchema } from "@DTOs/registration/RegistrationUpdateDTO";
import {
    RegistrationPaginateBodyInputSchema,
    RegistrationPaginateDTO,
} from "@DTOs/registration/RegistrationQueryDTO";
import {
    RegistrationRoleReassignDTO,
    RegistrationRoleReassignSchema,
} from "@DTOs/registration/RegistrationRoleDTO";

/**
 * `Registration` — §4.10. *Una iscrizione per persona per evento, con più
 * biglietti collegati.*
 *
 * `assignedRole` non è aggiornabile con il `PATCH`: la riassegnazione ha un
 * endpoint suo perché **muove capienza** — rilascia i consumi del vecchio ruolo e
 * impegna quelli del nuovo con le stesse verifiche di un acquisto.
 */
@Controller({
    route: "/registrations",
    tags: [{ name: "Registrations", description: "Event registrations" }],
})
export class RegistrationController {
    constructor(private readonly registrationService: RegistrationService) {}

    @POST("/create", {
        schema: {
            operationId: "createRegistration",
            summary: "Create Registration",
            description: "Creates a registration. `assignedRole` is server-computed by the capacity engine at payment confirmation and is not accepted here.",
            body: RegistrationCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.REGISTRATION, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: RegistrationCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.registrationService.save(+req.user.id, req.body));
    }

    /**
     * Sta **prima** di `GET /:id` di proposito: Fastify sceglie la rotta più
     * specifica, ma tenere l'ordine anche nel file evita che una lettura veloce
     * faccia credere che «mine» finisca nel parametro `:id`.
     */
    @GET("/mine", {
        schema: {
            operationId: "findMyRegistrations",
            summary: "My own registrations",
            description:
                "Returns the caller's own registrations — the ones where they are the registered person — split into `upcoming` and `past` on the event END date, each with a compact event card and its tickets. Deliberately outside the organization scope of §1.5: a dancer is not a tenant but the person named in the row, and their scope is empty, so the paginated list would hide their own registrations from them. The ticket `code` (the signed QR payload) is NOT returned here: it is served as an image by `GET /tickets/:id/qr`.",
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.REGISTRATION, PermissionScope.OWN),
        ],
    })
    async mine(req: FastifyRequest, reply: FastifyReply) {
        reply.status(200).send(await this.registrationService.findMine(+req.user.id));
    }

    @GET("/:id", {
        schema: {
            operationId: "findRegistration",
            summary: "Get Registration from id",
            description: "Returns a single registration by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.REGISTRATION, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.registrationService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateRegistration",
            summary: "Paginate Registration",
            description: "Returns a filtered and paginated list of registrations, restricted to the caller's scope.",
            body: RegistrationPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.REGISTRATION, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: RegistrationPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as RegistrationPaginateDTO;
        reply.status(200).send(await this.registrationService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateRegistration",
            summary: "Update Registration from id",
            description: "Partially updates the registration's own scalar fields. `assignedRole` and `status` are excluded: they move capacity and follow their own endpoints.",
            params: exz.pathId,
            body: RegistrationUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.REGISTRATION, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: RegistrationUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.registrationService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteRegistration",
            summary: "Delete Registration by id",
            description: "Soft deletes the registration and releases exactly the quota consumptions it holds, in the same transaction.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.REGISTRATION, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.registrationService.safeDeleteById(+req.user.id, +req.params.id));
    }

    // ─── Transizioni ─────────────────────────────────────────────────────────

    @POST("/:id/confirm", {
        schema: {
            operationId: "confirmRegistration",
            summary: "Confirm a Registration",
            description: "Marks the registration as CONFIRMED. TO_CONFIRM never blocks entry (RF-CPL-13): confirming only activates the profile and the non-essential communications.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.REGISTRATION, PermissionScope.SINGLE),
        ],
    })
    async confirm(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.registrationService.confirm(+req.user.id, +req.params.id));
    }

    @POST("/:id/decline", {
        schema: {
            operationId: "declineRegistration",
            summary: "Decline a Registration",
            description: "Declines the registration (RB24): the ticket goes back to the buyer's availability and the quota consumptions are released exactly.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.REGISTRATION, PermissionScope.SINGLE),
        ],
    })
    async decline(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.registrationService.decline(+req.user.id, +req.params.id));
    }

    @POST("/:id/reassign-role", {
        schema: {
            operationId: "reassignRegistrationRole",
            summary: "Reassign the dance role of a Registration",
            description: "Releases the consumptions of the old role and commits the new one in the SAME transaction. If the new role is sold out the operation is refused with SOLD_OUT and nothing changes.",
            params: exz.pathId,
            body: RegistrationRoleReassignSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.REGISTRATION, PermissionScope.SINGLE),
        ],
    })
    async reassignRole(
        req: FastifyRequest<{ Params: { id: string }, Body: RegistrationRoleReassignDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.registrationService.reassignRole(+req.user.id, +req.params.id, req.body));
    }
}
