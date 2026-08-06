import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { PurchaseService } from "@services/PurchaseService";
import { PurchasePaginateBodyInputSchema, PurchasePaginateDTO } from "@DTOs/order/OrderQueryDTO";

/**
 * `Purchase` — **sola lettura** (§3.4). Si crea solo dentro la transazione di
 * `POST /orders/reserve`: un acquisto creabile da fuori sarebbe un acquisto senza
 * ordini e senza capienza impegnata.
 */
@Controller({
    route: "/purchases",
    tags: [{ name: "Purchases", description: "Buyer-side grouping of the orders of one checkout" }],
})
export class PurchaseController {
    constructor(private readonly purchaseService: PurchaseService) {}

    @GET("/:id", {
        schema: {
            operationId: "findPurchase",
            summary: "Get Purchase from id",
            description: "Returns a single purchase by id — the buyer sees their own, the staff sees those containing an order of their organization.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.PURCHASE, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.purchaseService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginatePurchase",
            summary: "Paginate Purchase",
            description: "Returns a filtered and paginated list of purchases, restricted to the caller's scope.",
            body: PurchasePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.PURCHASE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: PurchasePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as PurchasePaginateDTO;
        reply.status(200).send(await this.purchaseService.paginate(+req.user.id, query, options));
    }
}
