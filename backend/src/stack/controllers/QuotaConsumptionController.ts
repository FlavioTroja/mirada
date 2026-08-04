import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { QuotaConsumptionService } from "@services/QuotaConsumptionService";
import {
    QuotaConsumptionPaginateBodyInputSchema,
    QuotaConsumptionPaginateDTO,
} from "@DTOs/quota_consumption/QuotaConsumptionQueryDTO";

/**
 * `QuotaConsumption` — **sola lettura** (§3.4, §4.9).
 *
 * Non esistono `create`, `update` né `delete`: si scrive **solo** attraverso il
 * servizio di capienza, dentro la transazione dell'impegno o del rilascio. È il
 * registro che rende il rilascio *esatto* anziché *ricostruito*; una scrittura da
 * fuori lo trasformerebbe in una copia inaffidabile dei contatori.
 */
@Controller({
    route: "/quota-consumptions",
    tags: [{ name: "QuotaConsumptions", description: "Read-only register of committed capacity" }],
})
export class QuotaConsumptionController {
    constructor(private readonly quotaConsumptionService: QuotaConsumptionService) {}

    @GET("/:id", {
        schema: {
            operationId: "findQuotaConsumption",
            summary: "Get QuotaConsumption from id",
            description: "Returns a single quota consumption by id, restricted to the caller's scope. Read-only resource.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.QUOTA_CONSUMPTION, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.quotaConsumptionService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateQuotaConsumption",
            summary: "Paginate QuotaConsumption",
            description: "Returns a filtered and paginated list of quota consumptions, restricted to the caller's scope. Read-only resource.",
            body: QuotaConsumptionPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.QUOTA_CONSUMPTION, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: QuotaConsumptionPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as QuotaConsumptionPaginateDTO;
        reply.status(200).send(await this.quotaConsumptionService.paginate(+req.user.id, query, options));
    }
}
