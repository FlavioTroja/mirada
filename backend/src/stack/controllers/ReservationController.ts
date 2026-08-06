import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { OrderReservationService } from "@services/OrderReservationService";
import { ReservationPaginateBodyInputSchema, ReservationPaginateDTO } from "@DTOs/order/OrderQueryDTO";

/**
 * `Reservation` — **sola lettura** (§3.4).
 *
 * Si crea con `POST /orders/reserve` e si rilascia con `abandon`, con
 * `confirm-free` o con lo scheduler delle scadenze. Una prenotazione che si
 * potesse creare da fuori sarebbe un modo per impegnare capienza senza un ordine
 * — cioè per togliere posti dalla sala senza comprare nulla.
 */
@Controller({
    route: "/reservations",
    tags: [{ name: "Reservations", description: "The 15-minute capacity hold of a checkout" }],
})
export class ReservationController {
    constructor(private readonly orderReservationService: OrderReservationService) {}

    @GET("/:id", {
        schema: {
            operationId: "findReservation",
            summary: "Get Reservation from id",
            description: "Returns a single reservation by id — the buyer sees their own, the staff those of their organization's events.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.RESERVATION, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.orderReservationService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateReservation",
            summary: "Paginate Reservation",
            description: "Returns a filtered and paginated list of reservations, restricted to the caller's scope. `active: true` selects the ones not yet released.",
            body: ReservationPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.RESERVATION, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: ReservationPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as ReservationPaginateDTO;
        reply.status(200).send(await this.orderReservationService.paginate(+req.user.id, query, options));
    }
}
