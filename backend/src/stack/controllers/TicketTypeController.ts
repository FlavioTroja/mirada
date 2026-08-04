import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { TicketTypeService } from "@services/TicketTypeService";
import { TicketTypeCreateDTO, TicketTypeCreateSchema } from "@DTOs/ticket_type/TicketTypeCreateDTO";
import { TicketTypeUpdateDTO, TicketTypeUpdateSchema } from "@DTOs/ticket_type/TicketTypeUpdateDTO";
import { TicketTypePaginateBodyInputSchema, TicketTypePaginateDTO } from "@DTOs/ticket_type/TicketTypeQueryDTO";
import { TicketTypeSessionUpdateDTO, TicketTypeSessionUpdateSchema } from "@DTOs/ticket_type/TicketTypeSessionUpdateDTO";
import { PriceTierUpdateDTO, PriceTierUpdateSchema } from "@DTOs/ticket_type/PriceTierUpdateDTO";
import { PricePreviewRequestDTO, PricePreviewRequestSchema } from "@DTOs/ticket_type/PricePreviewDTO";

/**
 * I cinque endpoint del dialetto più le due sub-risorse e l'anteprima di prezzo.
 *
 * **Il verbo della sub-risorsa è `PATCH`** — §3.2 e nota 1 del §3.10: la regola 12
 * di `.claude/rules/controllers.md` prescrive `PUT`, ma l'implementazione di
 * riferimento del template (`UserController.updateUserRoles`) usa
 * `@PATCH("/:id/roles")` e la skill `new-controller` elenca `PATCH`. Vale `PATCH`;
 * `PUT` resta riservato agli upload binari.
 *
 * Un solo endpoint per collezione, con l'array intero: `id: -1` per le righe
 * nuove, `toBeDisconnected: true` per quelle da rimuovere.
 */
@Controller({
    route: "/ticket-types",
    tags: [{ name: "TicketTypes", description: "Ticket type management" }],
})
export class TicketTypeController {
    constructor(private readonly ticketTypeService: TicketTypeService) {}

    @POST("/create", {
        schema: {
            operationId: "createTicketType",
            summary: "Create TicketType",
            description: "Creates a new ticket type. Included sessions and price tiers are owned children and are written through the two sub-resource PATCH endpoints.",
            body: TicketTypeCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.TICKET_TYPE, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: TicketTypeCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketTypeService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findTicketType",
            summary: "Get TicketType from id",
            description: "Returns a single ticket type by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.TICKET_TYPE, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.ticketTypeService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateTicketType",
            summary: "Paginate TicketType",
            description: "Returns a filtered and paginated list of ticket types, restricted to the caller's scope.",
            body: TicketTypePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.TICKET_TYPE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: TicketTypePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as TicketTypePaginateDTO;
        reply.status(200).send(await this.ticketTypeService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateTicketType",
            summary: "Update TicketType from id",
            description: "Partially updates the ticket type's own scalar fields.",
            params: exz.pathId,
            body: TicketTypeUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.TICKET_TYPE, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: TicketTypeUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketTypeService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteTicketType",
            summary: "Delete TicketType by id",
            description: "Soft deletes the ticket type. Refused when issued tickets exist.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.TICKET_TYPE, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketTypeService.safeDeleteById(+req.user.id, +req.params.id));
    }

    // ─── Sub-risorse: un solo PATCH per collezione, array intero (§3.2) ───────

    @PATCH("/:id/sessions", {
        schema: {
            operationId: "updateTicketTypeSessions",
            summary: "Replace the explicit session list of a TicketType",
            description: "Takes the whole array — id -1 for new rows, toBeDisconnected true for rows to remove. Removing a session is refused when issued tickets exist for the ticket type.",
            params: exz.pathId,
            body: TicketTypeSessionUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.TICKET_TYPE, PermissionScope.SINGLE),
        ],
    })
    async updateSessions(
        req: FastifyRequest<{ Params: { id: string }, Body: TicketTypeSessionUpdateDTO }>,
        reply: FastifyReply,
    ) {
        const result = await this.ticketTypeService.setSessions(+req.user.id, +req.params.id, req.body);
        if (!result) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(result);
    }

    @PATCH("/:id/price-tiers", {
        schema: {
            operationId: "updateTicketTypePriceTiers",
            summary: "Replace the price tiers of a TicketType",
            description: "Takes the whole array — id -1 for new rows, toBeDisconnected true for rows to remove. soldQuantity is server-owned; a tier with sales cannot be removed.",
            params: exz.pathId,
            body: PriceTierUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.TICKET_TYPE, PermissionScope.SINGLE),
        ],
    })
    async updatePriceTiers(
        req: FastifyRequest<{ Params: { id: string }, Body: PriceTierUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketTypeService.setPriceTiers(+req.user.id, +req.params.id, req.body));
    }

    @POST("/:id/price-preview", {
        schema: {
            operationId: "previewTicketTypePrice",
            summary: "Preview the active price tier",
            description: "Returns the server-computed price, the expiry criterion and the real remaining quantity at that price (RF-EVT-26).",
            params: exz.pathId,
            body: PricePreviewRequestSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.TICKET_TYPE, PermissionScope.SINGLE),
        ],
    })
    async pricePreview(
        req: FastifyRequest<{ Params: { id: string }, Body: PricePreviewRequestDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketTypeService.previewPrice(+req.user.id, +req.params.id, req.body ?? {}));
    }
}
