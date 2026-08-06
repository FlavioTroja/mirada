import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { OrderFulfilmentService } from "@services/OrderFulfilmentService";
import { PaymentPaginateBodyInputSchema, PaymentPaginateDTO } from "@DTOs/order/OrderQueryDTO";

/**
 * `Payment` — **sola lettura** (§3.4).
 *
 * Le righe nascono dentro la chiusura di un ordine: `POST /orders/:id/confirm-free`
 * oggi, il webhook Stripe della fase D2 domani. `idempotencyKey` è unica ed è la
 * difesa contro la doppia registrazione: un pagamento scrivibile da fuori
 * renderebbe quella difesa aggirabile con una `POST`.
 */
@Controller({
    route: "/payments",
    tags: [{ name: "Payments", description: "Settlement records of an order" }],
})
export class PaymentController {
    constructor(private readonly orderFulfilmentService: OrderFulfilmentService) {}

    @GET("/:id", {
        schema: {
            operationId: "findPayment",
            summary: "Get Payment from id",
            description: "Returns a single payment by id — the buyer sees their own, the OWNER those of their organization.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.PAYMENT, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.orderFulfilmentService.findPaymentById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginatePayment",
            summary: "Paginate Payment",
            description: "Returns a filtered and paginated list of payments, restricted to the caller's scope.",
            body: PaymentPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.PAYMENT, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: PaymentPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as PaymentPaginateDTO;
        reply.status(200).send(await this.orderFulfilmentService.paginatePayments(+req.user.id, query, options));
    }
}
