import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { CapacityQuotaService } from "@services/CapacityQuotaService";
import { CapacityEngineService } from "@services/CapacityEngineService";
import { CapacityQuotaCreateDTO, CapacityQuotaCreateSchema } from "@DTOs/capacity_quota/CapacityQuotaCreateDTO";
import { CapacityQuotaUpdateDTO, CapacityQuotaUpdateSchema } from "@DTOs/capacity_quota/CapacityQuotaUpdateDTO";
import {
    CapacityQuotaPaginateBodyInputSchema,
    CapacityQuotaPaginateDTO,
} from "@DTOs/capacity_quota/CapacityQuotaQueryDTO";

/**
 * CRUD delle quote di capienza — §4.8.
 *
 * **Nessun endpoint espone `consumed` in scrittura**: il contatore si muove solo
 * attraverso `CapacityEngineService`, dentro la transazione dell'impegno. Un
 * `PATCH` che lo accettasse permetterebbe di creare o cancellare posti con una
 * chiamata HTTP, senza che alcun `QuotaConsumption` ne porti traccia — e il
 * rilascio, che è esatto per costruzione, non avrebbe più nulla da restituire.
 */
@Controller({
    route: "/capacity-quotas",
    tags: [{ name: "CapacityQuotas", description: "Capacity quota configuration" }],
})
export class CapacityQuotaController {
    constructor(
        private readonly capacityQuotaService: CapacityQuotaService,
        private readonly capacityEngineService: CapacityEngineService,
    ) {}

    @POST("/create", {
        schema: {
            operationId: "createCapacityQuota",
            summary: "Create CapacityQuota",
            description: "Creates a capacity quota. `consumed` is server-owned and is never accepted from the client. On EVENT-scope quotas `overbookAllowance` is forced to 0 and `limiting` to true: they are safety constraints, not commercial ones.",
            body: CapacityQuotaCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.CAPACITY_QUOTA, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: CapacityQuotaCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.capacityQuotaService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findCapacityQuota",
            summary: "Get CapacityQuota from id",
            description: "Returns a single capacity quota by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.CAPACITY_QUOTA, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.capacityQuotaService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateCapacityQuota",
            summary: "Paginate CapacityQuota",
            description: "Returns a filtered and paginated list of capacity quotas, restricted to the caller's scope.",
            body: CapacityQuotaPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.CAPACITY_QUOTA, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: CapacityQuotaPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as CapacityQuotaPaginateDTO;
        reply.status(200).send(await this.capacityQuotaService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateCapacityQuota",
            summary: "Update CapacityQuota from id",
            description: "Partially updates the quota's own scalar fields. Raising the limit is always allowed; lowering it below `consumed` is allowed with a warning and closes online sales — no issued ticket is ever invalidated. Turning a non-limiting quota into a limiting one while consumed exceeds the limit is refused.",
            params: exz.pathId,
            body: CapacityQuotaUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.CAPACITY_QUOTA, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: CapacityQuotaUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.capacityQuotaService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteCapacityQuota",
            summary: "Delete CapacityQuota by id",
            description: "Soft deletes the quota. Refused when `consumed` is greater than zero: a quota with committed seats can only be closed, never removed.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.CAPACITY_QUOTA, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.capacityQuotaService.safeDeleteById(+req.user.id, +req.params.id));
    }

    /**
     * `05` §12 — I2 e I7 sono «le candidate naturali a un controllo periodico
     * automatico con allarme: una divergenza è il primo sintomo di una condizione
     * di corsa sfuggita ai test». Qui l'organizzatore (e il monitoraggio) possono
     * chiederlo su richiesta.
     */
    @GET("/events/:id/invariants", {
        schema: {
            operationId: "verifyCapacityInvariants",
            summary: "Verify the capacity invariants of an event",
            description: "Runs the invariant checks of 05-modello-capienza §12 (I2, I3, I4, I7) over the event and returns every violation found. A divergence is the first symptom of a race condition that escaped the tests.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.CAPACITY_QUOTA, PermissionScope.SINGLE),
        ],
    })
    async verifyInvariants(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        // Lo scope passa dal servizio di quota: senza appartenenza non si legge
        // nemmeno un conteggio aggregato di un'altra organizzazione (§1.5).
        await this.capacityQuotaService.suggestRoomCapacity(+req.user.id, +req.params.id);
        reply.status(200).send(await this.capacityEngineService.verifyInvariants(+req.params.id));
    }
}
