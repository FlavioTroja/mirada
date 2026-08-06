import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { OrderService } from "@services/OrderService";
import { OrderReservationService } from "@services/OrderReservationService";
import { OrderFulfilmentService } from "@services/OrderFulfilmentService";
import { OrderReserveDTO, OrderReserveSchema } from "@DTOs/order/OrderReserveDTO";
import {
    OrderConfirmFreeDTO,
    OrderConfirmFreeSchema,
    OrderConfirmPartialDTO,
    OrderConfirmPartialSchema,
} from "@DTOs/order/OrderActionsDTO";
import { OrderPaginateBodyInputSchema, OrderPaginateDTO } from "@DTOs/order/OrderQueryDTO";

/**
 * `Order` — backend-brief §4.11, §3.7.
 *
 * ── Che cosa NON c'è qui, e perché ───────────────────────────────────────────
 * Nessun `POST /orders/create`, nessun `PATCH /orders/:id`, nessun `DELETE`. Un
 * ordine **impegna capienza**: non è una riga che si crea a mano e non è una riga
 * che si modifica: nasce da `POST /orders/reserve`, che è atomico per costruzione,
 * e cambia solo attraverso i suoi verbi di dominio.
 *
 * ── La terna dichiarata ──────────────────────────────────────────────────────
 * Le cinque rotte d'azione dichiarano `CREATE#ORDER#OWN`, come prescrive il
 * §4.11 («`reserve`, `rearm`, `abandon`, `checkout`, `confirm-partial` con
 * `CREATE#ORDER#OWN` per il `DANCER`»), e la ricevuta `READ#ORDER#OWN`. Lo scope
 * `#OWN` **non è realizzato dalla stringa** (nota 8 del §3.10): è il servizio a
 * verificare che il chiamante sia l'acquirente o un membro dell'organizzazione
 * che incassa, e un ordine di un terzo risponde `404` — non `403`, che ne
 * confermerebbe l'esistenza.
 *
 * ── `POST /orders/:id/checkout` non è qui ────────────────────────────────────
 * Il PaymentIntent Stripe è **fase D2**, per decisione del committente. Il punto
 * d'innesto è documentato in `OrderFulfilmentService`: manca solo l'adapter.
 */
@Controller({
    route: "/orders",
    tags: [{ name: "Orders", description: "Checkout: reservation, hold and settlement" }],
})
export class OrderController {
    constructor(
        private readonly orderService: OrderService,
        private readonly orderReservationService: OrderReservationService,
        private readonly orderFulfilmentService: OrderFulfilmentService,
    ) {}

    @POST("/reserve", {
        schema: {
            operationId: "reserveOrder",
            summary: "Reserve an order",
            description:
                "Creates the purchase and one order per organizer, locks the server-computed price and atomically "
                + "commits capacity for 15 minutes. Fails with SALES_CLOSED, PAYOUT_NOT_ENABLED, SOLD_OUT, ROLE_ON_HOLD "
                + "or RESERVATION_ALREADY_ACTIVE; answers PARTIAL_AVAILABILITY when only accessory services ran out.",
            body: OrderReserveSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.ORDER, PermissionScope.OWN),
        ],
    })
    async reserve(
        req: FastifyRequest<{ Body: OrderReserveDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.orderService.reserve(+req.user.id, req.body));
    }

    @POST("/:id/rearm", {
        schema: {
            operationId: "rearmOrder",
            summary: "Rearm the order hold",
            description:
                "Extends the reservation to at least 10 remaining minutes at payment start, to cover the redirect to "
                + "the payment provider. Never shortens it. An expired reservation is not resurrected: RESERVATION_EXPIRED.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.ORDER, PermissionScope.OWN),
        ],
    })
    async rearm(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.orderReservationService.rearm(+req.user.id, +req.params.id));
    }

    @POST("/:id/abandon", {
        schema: {
            operationId: "abandonOrder",
            summary: "Abandon the order",
            description:
                "Immediately releases exactly the quota consumptions the order holds, closes the reservation as "
                + "ABANDONED and cancels the order. No deferral: the seat is worth something in the moment somebody "
                + "else is looking for it.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.ORDER, PermissionScope.OWN),
        ],
    })
    async abandon(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.orderReservationService.abandon(+req.user.id, +req.params.id));
    }

    @POST("/:id/confirm-partial", {
        schema: {
            operationId: "confirmPartialOrder",
            summary: "Confirm an order after PARTIAL_AVAILABILITY",
            description:
                "Explicit confirmation after PARTIAL_AVAILABILITY: removes the accepted lines, reconciles capacity in "
                + "the same transaction and recomputes the total on what is left (RF-PAY-15, RB17).",
            params: exz.pathId,
            body: OrderConfirmPartialSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.ORDER, PermissionScope.OWN),
        ],
    })
    async confirmPartial(
        req: FastifyRequest<{ Params: { id: string }, Body: OrderConfirmPartialDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.orderService.confirmPartial(+req.user.id, +req.params.id, req.body));
    }

    @POST("/:id/confirm-free", {
        schema: {
            operationId: "confirmFreeOrder",
            summary: "Close an order without a payment provider",
            description:
                "Resolves flexible roles, confirms the registrations, issues the tickets, closes the reservation as "
                + "COMPLETED and records a Payment with provider NONE. Allowed ONLY on a zero total or on an explicit "
                + "off-platform declaration by a member of the organization that collects — it is not a shortcut.",
            params: exz.pathId,
            body: OrderConfirmFreeSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.ORDER, PermissionScope.OWN),
        ],
    })
    async confirmFree(
        req: FastifyRequest<{ Params: { id: string }, Body: OrderConfirmFreeDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.orderFulfilmentService.confirmFree(+req.user.id, +req.params.id, req.body));
    }

    @GET("/:id/receipt", {
        schema: {
            operationId: "orderReceipt",
            summary: "Get the order receipt",
            description:
                "Returns { fileUrl } for the buyer's receipt. Like the ticket PDF it is NOT a fiscal document: no "
                + "progressive numbering, no VAT breakdown (RF-PAY-12, RF-TCK-11).",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ORDER, PermissionScope.OWN),
        ],
    })
    async receipt(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.orderService.receipt(+req.user.id, +req.params.id));
    }

    @GET("/:id", {
        schema: {
            operationId: "findOrder",
            summary: "Get Order from id",
            description: "Returns a single order by id, restricted to the buyer or to the staff of the collecting organization.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ORDER, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.orderService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateOrder",
            summary: "Paginate Order",
            description: "Returns a filtered and paginated list of orders, restricted to the caller's scope.",
            body: OrderPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ORDER, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: OrderPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as OrderPaginateDTO;
        reply.status(200).send(await this.orderService.paginate(+req.user.id, query, options));
    }
}
