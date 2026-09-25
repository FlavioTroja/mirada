import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { DashboardTodayService } from "@services/DashboardTodayService";
import { ActivityService } from "@services/ActivityService";
import { DashboardActivityQueryDTO, DashboardActivityQuerySchema } from "@DTOs/dashboard/DashboardActivityQueryDTO";

/**
 * La Dashboard dell'organizzazione — `21-dashboard.md`. Il cruscotto di un
 * evento resta in `GET /events/:id/dashboard`.
 */
@Controller({
    route: "/dashboard",
    tags: [{ name: "Dashboard", description: "The organization's day at a glance" }],
})
export class DashboardController {
    constructor(
        private readonly dashboardTodayService: DashboardTodayService,
        private readonly activityService: ActivityService,
    ) {}

    @GET("/today", {
        schema: {
            operationId: "getDashboardToday",
            summary: "Today's dashboard",
            description: "The caller's organizations today (Europe/Rome day): today's sessions with expected and entries (none for course lessons, which issue no tickets), entries per quarter hour, registrations of today and the last 8 days, money cashed today in cents, open balances, things to fix, and the next event's dashboard.",
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.DASHBOARD, PermissionScope.ALL),
        ],
    })
    async today(req: FastifyRequest, reply: FastifyReply) {
        reply.status(200).send(await this.dashboardTodayService.today(+req.user.id));
    }

    @GET("/activity", {
        schema: {
            operationId: "getDashboardActivity",
            summary: "Recent activity",
            description: "What happened in the caller's organizations, newest first: entries, registrations, payments (in cents), calendar changes by the staff, open-day contacts. Default: the last 24 hours, at most 50 rows. staffOnly=true keeps only staff actions (the day's log). Rows older than 30 days are removed.",
            querystring: DashboardActivityQuerySchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.DASHBOARD, PermissionScope.ALL),
        ],
    })
    async activity(req: FastifyRequest<{ Querystring: DashboardActivityQueryDTO }>, reply: FastifyReply) {
        const { since, limit, staffOnly } = req.query;
        reply.status(200).send(await this.activityService.recent(+req.user.id, {
            since: since ?? new Date(Date.now() - 86_400_000),
            limit,
            staffOnly,
        }));
    }
}
