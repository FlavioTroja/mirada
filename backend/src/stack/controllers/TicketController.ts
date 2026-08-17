import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { TicketService } from "@services/TicketService";
import { CheckInService } from "@services/CheckInService";
import { TicketCreateDTO, TicketCreateSchema } from "@DTOs/ticket/TicketCreateDTO";
import { TicketUpdateDTO, TicketUpdateSchema } from "@DTOs/ticket/TicketUpdateDTO";
import { TicketPaginateBodyInputSchema, TicketPaginateDTO } from "@DTOs/ticket/TicketQueryDTO";
import { TicketTransferRequestDTO, TicketTransferRequestSchema } from "@DTOs/ticket/TicketTransferDTO";
import { TicketVerifyDTO, TicketVerifySchema } from "@DTOs/ticket/TicketVerifyDTO";

/**
 * `Ticket` — §4.12.
 *
 * ── Le terne di permesso, e perché sono quelle ───────────────────────────────
 * La cella `TICKET` del §3.8 concede `READ`/`UPDATE#OWN` a `OWNER`,
 * `EVENT_MANAGER` e `DANCER`, e `READ#OWN` al `CHECKIN_OPERATOR`. Ne discende:
 *
 * - `POST /tickets/:id/transfer` dichiara **`UPDATE#TICKET#SINGLE`**, non
 *   `CREATE#TICKET_TRANSFER#…`. È l'unica terna che i tre ruoli che vedono
 *   l'azione «trasferisci» possiedono davvero — il §3.8 concede `CREATE` su
 *   `TICKET_TRANSFER` al solo `DANCER`, mentre il frontend brief (§4.4) mette
 *   l'azione anche su `/tickets`, che è di `OWNER` ed `EVENT_MANAGER`. Il
 *   trasferimento **è** un aggiornamento del titolare del biglietto, e la riga di
 *   `TicketTransfer` è il suo storico: la nota 8 del §3.10 dice esplicitamente
 *   che la matrice va letta come dichiarazione di *chi può fare cosa*, non come
 *   la stringa letterale seminata. Nessuna concessione è stata allargata.
 * - `POST /tickets/verify` dichiara **`READ#TICKET#SINGLE`**: risolve un
 *   biglietto e non scrive nulla. Il `CHECKIN_OPERATOR` la possiede, il `DANCER`
 *   pure — e non è un problema, perché la verifica di un codice altrui non
 *   rivela nulla che il codice stesso non riveli.
 */
@Controller({
    route: "/tickets",
    tags: [{ name: "Tickets", description: "Issued tickets, transfers and door verification" }],
})
export class TicketController {
    constructor(
        private readonly ticketService: TicketService,
        private readonly checkInService: CheckInService,
    ) {}

    @POST("/create", {
        schema: {
            operationId: "createTicket",
            summary: "Create Ticket",
            description: "Issues a ticket. The code and the signed QR are server-computed and never accepted from the client: a ticket whose code comes from outside is a ticket anybody can forge. In practice tickets are born from a paid order line or from a manual pass issuance; no interface role holds CREATE#TICKET.",
            body: TicketCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.TICKET, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: TicketCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findTicket",
            summary: "Get Ticket from id",
            description: "Returns a single ticket by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.TICKET, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.ticketService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateTicket",
            summary: "Paginate Ticket",
            description: "Returns a filtered and paginated list of tickets, restricted to the caller's scope.",
            body: TicketPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.TICKET, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: TicketPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as TicketPaginateDTO;
        reply.status(200).send(await this.ticketService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateTicket",
            summary: "Update Ticket from id",
            description: "Updates the holder's name and the ticket status. Setting CANCELLED or REFUNDED also revokes the QR. There is no USED status and there must never be one: usage is a CheckIn row on the ticket-session pair, and a Full Pass scanned twelve times stays VALID.",
            params: exz.pathId,
            body: TicketUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.TICKET, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: TicketUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteTicket",
            summary: "Delete Ticket by id",
            description: "Soft deletes the ticket.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.TICKET, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketService.safeDeleteById(+req.user.id, +req.params.id));
    }

    // ─── Non-CRUD del §3.7 ───────────────────────────────────────────────────

    @GET("/:id/pdf", {
        schema: {
            operationId: "getTicketPdf",
            summary: "Order confirmation PDF of a Ticket",
            description: "Returns { fileUrl } for the order confirmation carrying the signed QR. RF-TCK-11: this is an order confirmation with an access code, NEVER a fiscal document — no progressive numbering, no seal, no wording that could make it look like one. It is one of the three conditions holding up the platform's fiscal positioning, not a copywriting choice.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.TICKET, PermissionScope.SINGLE),
        ],
    })
    async pdf(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketService.pdf(+req.user.id, +req.params.id));
    }

    @GET("/:id/qr", {
        schema: {
            operationId: "getTicketQr",
            summary: "QR image of a Ticket",
            description: "Returns the ticket QR as a PNG, ready to be shown on screen at the door. The signed JWS itself is never returned as text: it is the entry key, and serving it as a string would spread it through browser memory, request logs and history for no gain — the image is what gets scanned. Visible to the organization staff of the event OR to the ticket holder. Answers 404 when the QR has been revoked (refund, cancellation): showing a QR that the scanner refuses would send someone to the door believing they hold a valid ticket.",
            params: exz.pathId,
            produces: ["image/png"],
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.TICKET, PermissionScope.SINGLE),
        ],
    })
    async qr(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        const image = await this.ticketService.qrImage(+req.user.id, +req.params.id);
        if (!image) {
            throw new httpErrors.NotFound("Questo biglietto non ha un QR valido.");
        }
        reply
            .status(200)
            .header("Content-Type", "image/png")
            // Privato: è la chiave d'ingresso di una persona, non deve restare
            // in nessuna cache condivisa fra chi passa dalla stessa rete.
            .header("Cache-Control", "private, no-store")
            .header("Content-Disposition", `inline; filename="${image.filename}"`)
            .send(image.png);
    }

    @POST("/:id/transfer", {
        schema: {
            operationId: "transferTicket",
            summary: "Transfer a Ticket to another holder",
            description: "RB8: revokes the previous QR, issues a new one, moves the registration and revaluates the requirements on the new holder. If the new holder dances the other role, the old role is released and the new one committed IN THE SAME TRANSACTION: if the new role is sold out the transfer is refused and NOTHING changes. Bearer passes are not transferable. The financial settlement of the transfer is between the two dancers, outside the platform (RF-TCK-9).",
            params: exz.pathId,
            body: TicketTransferRequestSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.TICKET, PermissionScope.SINGLE),
        ],
    })
    async transfer(
        req: FastifyRequest<{ Params: { id: string }, Body: TicketTransferRequestDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.ticketService.transfer(+req.user.id, +req.params.id, req.body));
    }

    @POST("/verify", {
        schema: {
            operationId: "verifyTicket",
            summary: "Verify a ticket at the door",
            description: "Online verification, WITHOUT writing anything: returns one of the five CheckInResult values. On REQUIREMENT_BLOCKED it names the missing requirement (its label, never its content); on ALREADY_USED it returns time and station of the first entry. `code` accepts either the bare ticket code or the compact JWS read from the QR — in that case the Ed25519 signature is verified here too, and an unknown keyId is a refusal. RB12: the response carries name, dance role, ticket type, included sessions and purchased services — never contacts, never requirement content, never diets.",
            body: TicketVerifySchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.TICKET, PermissionScope.SINGLE),
        ],
    })
    async verify(
        req: FastifyRequest<{ Body: TicketVerifyDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.checkInService.verify(req.body));
    }
}
