import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { BalanceSettlementService } from "@services/BalanceSettlementService";
import {
    BalanceSettlementCreateDTO,
    BalanceSettlementCreateSchema,
    BalanceSettlementSyncDTO,
    BalanceSettlementSyncSchema,
} from "@DTOs/balance_settlement/BalanceSettlementCreateDTO";
import {
    BalanceSettlementPaginateBodyInputSchema,
    BalanceSettlementPaginateDTO,
} from "@DTOs/balance_settlement/BalanceSettlementQueryDTO";

/**
 * `BalanceSettlement` — il registro dei saldi incassati al botteghino
 * (`14-acconto-e-saldo.md` §6).
 *
 * ── Chi entra da queste rotte ───────────────────────────────────────────────
 * La cella `BALANCE_SETTLEMENT` concede `CREATE`/`READ#OWN` al `BOX_OFFICE` e
 * l'insieme pieno a `OWNER` ed `EVENT_MANAGER`. Il `CHECKIN_OPERATOR` **non
 * compare, ed è il punto**: `RB27` dice che chi non tiene la cassa vede *che* un
 * saldo esiste, mai quanto vale. Quel flag viaggia con la verifica del biglietto
 * e con il manifesto offline, non di qui.
 *
 * ── Nessun `DELETE`, nessun `PATCH` sull'importo ────────────────────────────
 * Una riga di incasso è un fatto: qualcuno ha preso in mano dei soldi. Si
 * corregge con una riga che la contraddice, non facendola sparire — altrimenti
 * la cassa quadra sullo schermo e non nel cassetto.
 */
@Controller({
    route: "/balance-settlements",
    tags: [{ name: "Balance settlements", description: "Deposit balances collected at the box office" }],
})
export class BalanceSettlementController {
    constructor(private readonly balanceSettlementService: BalanceSettlementService) {}

    @POST("/create", {
        schema: {
            operationId: "createBalanceSettlement",
            summary: "Record a balance collected at the box office",
            description:
                "Records one collection against a registration's outstanding balance and moves the server-side counter "
                + "in the same transaction. RB26: this is NOT a platform payment — no Payment row is written, and the "
                + "fiscal duties on that cash stay with the organizer. Refused when the registration owes nothing, is "
                + "already settled, or the amount exceeds what is still open: with the person still at the desk, saying "
                + "the right figure costs nothing. The same endpoint records a bank transfer that arrived weeks before "
                + "the event (RF-SAL-10) — same row, no station.",
            body: BalanceSettlementCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.BALANCE_SETTLEMENT, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: BalanceSettlementCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.balanceSettlementService.save(+req.user.id, req.body));
    }

    @POST("/sync", {
        schema: {
            operationId: "syncBalanceSettlements",
            summary: "Sync the box office offline queue",
            description:
                "Takes the queue collected without network and answers { accepted[], conflicts[], rejected[] }. RF-SAL-11: "
                + "a double collection — two disconnected stations on the same balance — CREATES the row, marks it as a "
                + "conflict and leaves it to the staff. It is never dropped: that money was really taken, and making the "
                + "books balance on the phone instead of in the cash box is not an option. deviceReference makes the same "
                + "entry synced twice a single row.",
            body: BalanceSettlementSyncSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.BALANCE_SETTLEMENT, PermissionScope.ALL),
        ],
    })
    async sync(
        req: FastifyRequest<{ Body: BalanceSettlementSyncDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.balanceSettlementService.sync(+req.user.id, req.body));
    }

    @GET("/registration/:id", {
        schema: {
            operationId: "findRegistrationBalance",
            summary: "Get the outstanding balance of a registration",
            description:
                "Returns what the person owes, what has been collected, what is still open, and every collection with "
                + "operator and time. RB27: this carries the FIGURE, which is why it asks for the box-office permission — "
                + "the door operator gets a flag with the ticket verification instead, and never an amount.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.BALANCE_SETTLEMENT, PermissionScope.SINGLE),
        ],
    })
    async registrationBalance(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.balanceSettlementService.balanceOf(+req.user.id, +req.params.id));
    }

    @GET("/:id", {
        schema: {
            operationId: "findBalanceSettlement",
            summary: "Get BalanceSettlement from id",
            description: "Returns a single collection by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.BALANCE_SETTLEMENT, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.balanceSettlementService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateBalanceSettlement",
            summary: "Paginate BalanceSettlement",
            description:
                "Returns a filtered and paginated list of collections, restricted to the caller's scope. `conflictsOnly` "
                + "returns the double collections still to be resolved; `eventId` gives the evening's cash register.",
            body: BalanceSettlementPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.BALANCE_SETTLEMENT, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: BalanceSettlementPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as BalanceSettlementPaginateDTO;
        reply.status(200).send(await this.balanceSettlementService.paginate(+req.user.id, query, options));
    }
}
