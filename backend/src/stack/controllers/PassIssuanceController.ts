import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { PassIssuanceService } from "@services/PassIssuanceService";
import { PassIssuanceCreateDTO, PassIssuanceCreateSchema } from "@DTOs/pass_issuance/PassIssuanceCreateDTO";
import { PassIssuanceUpdateDTO, PassIssuanceUpdateSchema } from "@DTOs/pass_issuance/PassIssuanceUpdateDTO";
import {
    PassIssuancePaginateBodyInputSchema,
    PassIssuancePaginateDTO,
} from "@DTOs/pass_issuance/PassIssuanceQueryDTO";

/**
 * `PassIssuance` — §4.12. Cella `∀#OWN` per `OWNER` ed `EVENT_MANAGER`; il
 * `CHECKIN_OPERATOR` e il `DANCER` non hanno accesso.
 *
 * L'**emissione** vera e propria è `POST /events/:id/pass-issuances/bulk`
 * (`EventController`), perché è un'operazione sull'evento: crea iscrizioni,
 * biglietti e consumi di capienza in una transazione sola.
 */
@Controller({
    route: "/pass-issuances",
    tags: [{ name: "PassIssuances", description: "Manual pass issuance records" }],
})
export class PassIssuanceController {
    constructor(private readonly passIssuanceService: PassIssuanceService) {}

    @POST("/create", {
        schema: {
            operationId: "createPassIssuance",
            summary: "Record a pass issuance",
            description: "Records the act of issuing passes WITHOUT emitting tickets — the way to reconcile an issuance that happened elsewhere. The real issuance is POST /events/:id/pass-issuances/bulk. `issuedByUserId` and `issuedAt` are server-computed.",
            body: PassIssuanceCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.PASS_ISSUANCE, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: PassIssuanceCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.passIssuanceService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findPassIssuance",
            summary: "Get PassIssuance from id",
            description: "Returns a single pass issuance by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.PASS_ISSUANCE, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.passIssuanceService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginatePassIssuance",
            summary: "Paginate PassIssuance",
            description: "Returns a filtered and paginated list of pass issuances, restricted to the caller's scope.",
            body: PassIssuancePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.PASS_ISSUANCE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: PassIssuancePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as PassIssuancePaginateDTO;
        reply.status(200).send(await this.passIssuanceService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updatePassIssuance",
            summary: "Update PassIssuance from id",
            description: "Only the note is editable: quantity, ticket type, role and reason describe an act already performed, and rewriting them would not correct the issuance — the tickets already emitted, with their capacity consumptions, would stay as they were.",
            params: exz.pathId,
            body: PassIssuanceUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.PASS_ISSUANCE, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: PassIssuanceUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.passIssuanceService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deletePassIssuance",
            summary: "Revoke a PassIssuance",
            description: "Revokes the issuance, cancels its tickets and releases exactly the quota consumptions they held, in one transaction. A withdrawn comp that left its seat occupied would be pure drift between counters and reality.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.PASS_ISSUANCE, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.passIssuanceService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
