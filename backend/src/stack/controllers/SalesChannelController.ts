import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST, PUT } from "fastify-decorators";
import { z } from "zod";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { rateLimit } from "@utils/adapters/rateLimit";
import { readRawBody } from "@utils/adapters/rawBody";
import { SalesChannelService } from "@services/SalesChannelService";
import { ExternalSaleIngestionService } from "@services/ExternalSaleIngestionService";
import { SalesChannelCreateDTO, SalesChannelCreateSchema } from "@DTOs/sales_channel/SalesChannelCreateDTO";
import { SalesChannelUpdateDTO, SalesChannelUpdateSchema } from "@DTOs/sales_channel/SalesChannelUpdateDTO";
import {
    SalesChannelPaginateBodyInputSchema,
    SalesChannelPaginateDTO,
} from "@DTOs/sales_channel/SalesChannelQueryDTO";
import {
    SalesChannelMappingUpdateDTO,
    SalesChannelMappingUpdateSchema,
} from "@DTOs/sales_channel/SalesChannelMappingUpdateDTO";

const PublicIdParamSchema = z.object({
    publicId: z.string().min(1).describe("Opaque public id of the sales channel — the webhook URL segment"),
});

/**
 * `SalesChannel` — i negozi esterni collegati a un'organizzazione (fase E).
 *
 * ── Una rotta pubblica in mezzo a rotte protette ────────────────────────────
 * `POST /sales-channels/webhook/:publicId` **non porta `Authenticate()`**, ed è
 * deliberato: chi bussa è un negozio, non una persona, e non ha né potrebbe
 * avere un gettone di Mirada. La sua identità è **la firma HMAC sul corpo
 * grezzo**, verificata dentro il servizio con il segreto di quel canale.
 *
 * È una categoria nuova per questo backend: fino a qui l'autenticazione era il
 * gettone (`Authenticate`) o niente (`PublicController`, dove la restrizione è
 * di stato). Qui è la firma, e il presidio sta nel servizio perché è lì che vive
 * il segreto.
 */
@Controller({
    route: "/sales-channels",
    tags: [{ name: "Sales channels", description: "External shops declaring their own sales" }],
})
export class SalesChannelController {
    constructor(
        private readonly salesChannelService: SalesChannelService,
        private readonly ingestionService: ExternalSaleIngestionService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // La rotta del negozio
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * ⚠️ **Il corpo non è validato con Zod, ed è voluto.** La firma si calcola
     * sui byte spediti: uno schema che li analizzi e li rimpiazzi con il proprio
     * risultato distruggerebbe proprio ciò che serve a verificarla. Il corpo
     * grezzo arriva da `registerRawBodyCapture`, e la forma la controlla
     * l'adapter del prestatore **dopo** che la firma è risultata valida — nessun
     * campo di quel corpo viene mai creduto prima di allora.
     *
     * ⚠️ **Risponde `200` in fretta.** Shopify stacca a cinque secondi e, sopra
     * una certa quota di consegne fallite, smette di notificare del tutto:
     * l'elaborazione avviene fuori dal ciclo della richiesta.
     *
     * Il rate limiting è largo di proposito — trecento al minuto per indirizzo.
     * Non serve a moderare il negozio, che in apertura vendite ha tutto il
     * diritto di essere veloce: serve a impedire che una rotta pubblica che fa
     * una lettura e un HMAC diventi il modo più economico di occupare il pool di
     * connessioni.
     */
    @POST("/webhook/:publicId", {
        schema: {
            operationId: "receiveSalesChannelNotification",
            summary: "Receive a signed notification from an external shop",
            description:
                "Verifies the provider's HMAC signature over the RAW body, records the delivery and answers 200 "
                + "immediately; ingestion happens outside the request cycle. Unauthenticated by design: the caller is a "
                + "shop, and its identity is the signature. Replayed deliveries are a no-op (RF-EXT-4).",
            params: PublicIdParamSchema,
        },
        onRequest: [
            rateLimit({ name: "sales-channel-webhook", max: 300, windowMs: 60_000 }),
        ],
    })
    async receiveNotification(
        req: FastifyRequest<{ Params: { publicId: string } }>,
        reply: FastifyReply,
    ) {
        const outcome = await this.ingestionService.receive(
            req.params.publicId,
            readRawBody(req),
            req.headers,
        );
        reply.status(200).send(outcome);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CRUD del dialetto (§3.2)
    // ─────────────────────────────────────────────────────────────────────────

    @POST("/create", {
        schema: {
            operationId: "createSalesChannel",
            summary: "Connect an external shop",
            description:
                "Connects a shop to an organization. The webhook secret and the admin token travel in clear and are "
                + "stored SEALED (AES-256-GCM): no read route ever returns them. The webhook's public id is generated "
                + "by the server.",
            body: SalesChannelCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.SALES_CHANNEL, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: SalesChannelCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.salesChannelService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findSalesChannel",
            summary: "Get SalesChannel from id",
            description: "Returns a single sales channel of the caller's organization. Secrets are never included.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.SALES_CHANNEL, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.salesChannelService.findById(+req.user.id, +req.params.id, req.query));
    }

    @POST("/", {
        schema: {
            operationId: "paginateSalesChannel",
            summary: "Paginate SalesChannel",
            description: "Returns a filtered and paginated list of sales channels, restricted to the caller's scope.",
            body: SalesChannelPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.SALES_CHANNEL, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: SalesChannelPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as SalesChannelPaginateDTO;
        reply.status(200).send(await this.salesChannelService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateSalesChannel",
            summary: "Update SalesChannel",
            description:
                "Updates the channel's own scalars. Secrets may be REPLACED — a revoked token is replaced by a new "
                + "one — and are sealed again on the way in. Organization, provider and public id are immutable.",
            params: exz.pathId,
            body: SalesChannelUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.SALES_CHANNEL, PermissionScope.SINGLE),
        ],
    })
    async update(
        req: FastifyRequest<{ Params: { id: string }, Body: SalesChannelUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.salesChannelService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteSalesChannel",
            summary: "Disconnect a sales channel",
            description:
                "Logical deletion. Sales already ingested stay attached to the channel they came from: a commercial "
                + "trail that disappears when a shop is disconnected is not a trail.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.SALES_CHANNEL, PermissionScope.SINGLE),
        ],
    })
    async remove(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.salesChannelService.deleteById(+req.user.id, +req.params.id));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Le associazioni prodotto → titolo (regola 12)
    // ─────────────────────────────────────────────────────────────────────────

    @PUT("/:id/mappings", {
        schema: {
            operationId: "updateSalesChannelMappings",
            summary: "Replace the product mappings of a sales channel",
            description:
                "Takes the WHOLE desired collection: id -1 creates, toBeDisconnected removes, the rest updates. A row "
                + "with a null ticketTypeId means 'this article is not a ticket, ignore it' — which is what keeps a "
                + "mixed order (passes plus a T-shirt) out of quarantine.",
            params: exz.pathId,
            body: SalesChannelMappingUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.SALES_CHANNEL, PermissionScope.SINGLE),
        ],
    })
    async updateMappings(
        req: FastifyRequest<{ Params: { id: string }, Body: SalesChannelMappingUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(
            await this.salesChannelService.updateMappings(+req.user.id, +req.params.id, req.body),
        );
    }
}
