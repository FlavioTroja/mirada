import { Controller, POST } from "fastify-decorators";
import { FastifyReply, FastifyRequest } from "fastify";
import { Log } from "@utils/adapters/log";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { PermissionResource } from "@enums/PermissionResource";
import { OrderReservationService } from "@services/OrderReservationService";

/**
 * Manual entrypoints for the scheduled jobs: one POST route per job (kebab-case action),
 * sharing the exact service method the cron tick runs. New jobs add their route here.
 */
@Controller({
    route: "/cron",
    tags: [{ name: "Cron", description: "Manual triggers for scheduled jobs" }],
})
export class CronController {

    constructor(
        private readonly orderReservationService: OrderReservationService,
    ) {
    }

    /**
     * Lo scheduler delle prenotazioni scadute (§4.11, `RF-PAY-24`, nota 7 del
     * §3.10). Esegue **lo stesso metodo** del tick di `ReservationExpiryJob`: un
     * job che si potesse lanciare solo aspettando non sarebbe collaudabile.
     *
     * Nessun ruolo dell'interfaccia ha concessioni su `CRON`: la rotta è di fatto
     * riservata a `GOD`, che è ciò che serve a uno strumento di esercizio.
     */
    @POST("/release-expired-reservations", {
        schema: {
            operationId: "releaseExpiredReservations",
            summary: "Release expired reservations",
            description:
                "Runs one pass of the expired-reservation sweep: releases exactly the quota consumptions held by "
                + "reservations past their expiry, marks them EXPIRED, expires their orders and notifies each buyer "
                + "over WebSocket. Same method the cron tick runs every minute (RF-PAY-24, risk R1b).",
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.CRON, PermissionScope.ALL),
        ],
    })
    async releaseExpiredReservations(
        _req: FastifyRequest,
        reply: FastifyReply,
    ) {
        Log.info("[Cron Controller]: manual trigger of the expired-reservation sweep");
        reply.status(200).send(await this.orderReservationService.releaseExpired());
    }
}
