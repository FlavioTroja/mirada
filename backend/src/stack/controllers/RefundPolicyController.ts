import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { RefundPolicyService } from "@services/RefundPolicyService";
import { RefundPolicyCreateDTO, RefundPolicyCreateSchema } from "@DTOs/refund_policy/RefundPolicyCreateDTO";
import { RefundPolicyUpdateDTO, RefundPolicyUpdateSchema } from "@DTOs/refund_policy/RefundPolicyUpdateDTO";
import { RefundPolicyPaginateBodyInputSchema, RefundPolicyPaginateDTO } from "@DTOs/refund_policy/RefundPolicyQueryDTO";

/**
 * Ogni rotta porta il principale al servizio: l'isolamento fra organizzazioni
 * (§1.5) è realizzato dal filtro obbligatorio nei finder di repository, non dal
 * solo controllo di permesso.
 */
@Controller({
    route: "/refund-policies",
    tags: [{ name: "RefundPolicys", description: "RefundPolicy management" }],
})
export class RefundPolicyController {
    constructor(private readonly refundPolicyService: RefundPolicyService) {}

    @POST("/create", {
        schema: {
            operationId: "createRefundPolicy",
            summary: "Create RefundPolicy",
            description: "Creates a new refund policy inside the caller's organization scope.",
            body: RefundPolicyCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.REFUND_POLICY, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: RefundPolicyCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.refundPolicyService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findRefundPolicy",
            summary: "Get RefundPolicy from id",
            description: "Returns a single refund policy by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.REFUND_POLICY, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.refundPolicyService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateRefundPolicy",
            summary: "Paginate RefundPolicy",
            description: "Returns a filtered and paginated list of refund policys, restricted to the caller's scope.",
            body: RefundPolicyPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.REFUND_POLICY, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: RefundPolicyPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as RefundPolicyPaginateDTO;
        reply.status(200).send(await this.refundPolicyService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateRefundPolicy",
            summary: "Update RefundPolicy from id",
            description: "Partially updates the refund policy's own scalar fields.",
            params: exz.pathId,
            body: RefundPolicyUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.REFUND_POLICY, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: RefundPolicyUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.refundPolicyService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteRefundPolicy",
            summary: "Delete RefundPolicy by id",
            description: "Soft deletes the refund policy.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.REFUND_POLICY, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.refundPolicyService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
