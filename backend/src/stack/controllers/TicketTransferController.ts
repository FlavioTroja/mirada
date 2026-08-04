import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { TicketTransferService } from "@services/TicketTransferService";
import {
    TicketTransferPaginateBodyInputSchema,
    TicketTransferPaginateDTO,
} from "@DTOs/ticket_transfer/TicketTransferQueryDTO";

/**
 * `TicketTransfer` — **sola lettura** (§3.4): storico completo dei passaggi di
 * titolarità. Le righe nascono soltanto dentro la transazione di
 * `POST /tickets/:id/transfer`, e non esiste alcun endpoint che le crei, le
 * modifichi o le cancelli: uno storico che si può riscrivere non è uno storico.
 */
@Controller({
    route: "/ticket-transfers",
    tags: [{ name: "TicketTransfers", description: "Read-only history of ticket ownership changes" }],
})
export class TicketTransferController {
    constructor(private readonly ticketTransferService: TicketTransferService) {}

    @GET("/:id", {
        schema: {
            operationId: "findTicketTransfer",
            summary: "Get TicketTransfer from id",
            description: "Returns a single transfer by id, restricted to the caller's scope. Read-only resource.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.TICKET_TRANSFER, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.ticketTransferService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateTicketTransfer",
            summary: "Paginate TicketTransfer",
            description: "Returns a filtered and paginated list of ticket transfers, restricted to the caller's scope. Read-only resource: transfers are created only by POST /tickets/:id/transfer.",
            body: TicketTransferPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.TICKET_TRANSFER, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: TicketTransferPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as TicketTransferPaginateDTO;
        reply.status(200).send(await this.ticketTransferService.paginate(+req.user.id, query, options));
    }
}
