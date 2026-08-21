import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { SalesChannelService } from "@services/SalesChannelService";
import {
    ExternalSalePaginateBodyInputSchema,
    ExternalSalePaginateDTO,
} from "@DTOs/external_sale/ExternalSaleQueryDTO";

/**
 * `ExternalSale` — le vendite dichiarate dai negozi esterni (fase E).
 *
 * **Sola lettura, più una rotta d'azione.** Le righe nascono dall'ingestione, mai
 * da una `POST`: una vendita esterna scrivibile da fuori sarebbe un modo per
 * emettere biglietti senza che nessuno abbia pagato nulla, da qualunque parte.
 *
 * L'azione è `reingest`, e serve a una cosa sola: rimediare a una quarantena
 * dopo aver corretto la mappatura.
 */
@Controller({
    route: "/external-sales",
    tags: [{ name: "External sales", description: "Sales declared by an external shop" }],
})
export class ExternalSaleController {
    constructor(private readonly salesChannelService: SalesChannelService) {}

    @GET("/:id", {
        schema: {
            operationId: "findExternalSale",
            summary: "Get ExternalSale from id",
            description:
                "Returns a single external sale of the caller's organization, with its quarantine reason when it has one.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EXTERNAL_SALE, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.salesChannelService.findSaleById(+req.user.id, +req.params.id, req.query));
    }

    @POST("/", {
        schema: {
            operationId: "paginateExternalSale",
            summary: "Paginate ExternalSale",
            description:
                "Returns a filtered and paginated list of external sales, restricted to the caller's scope. Filtering "
                + "by status QUARANTINED is how the back-office lists what is waiting for a human.",
            body: ExternalSalePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.EXTERNAL_SALE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: ExternalSalePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as ExternalSalePaginateDTO;
        reply.status(200).send(await this.salesChannelService.paginateSales(+req.user.id, query, options));
    }

    /**
     * `UPDATE` e non `CREATE`: rielaborare non crea una vendita — quella esiste
     * già ed è ferma. Cambia il suo stato, ed è un atto di chi governa il canale.
     */
    @POST("/:id/reingest", {
        schema: {
            operationId: "reingestExternalSale",
            summary: "Re-process a quarantined external sale",
            description:
                "Replays ingestion from the sale's own canonical payload — not from the shop, whose availability is "
                + "exactly what one cannot count on while fixing a fault. Idempotent: a sale already INGESTED is a no-op.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.EXTERNAL_SALE, PermissionScope.SINGLE),
        ],
    })
    async reingest(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.salesChannelService.reingest(+req.user.id, +req.params.id));
    }
}
