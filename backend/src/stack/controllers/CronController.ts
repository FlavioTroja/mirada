import { Controller, POST } from "fastify-decorators";
import { FastifyReply, FastifyRequest } from "fastify";
import { Log } from "@utils/adapters/log";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { PermissionResource } from "@enums/PermissionResource";

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
    ) {
    }

}
