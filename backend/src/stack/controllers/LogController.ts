import { Controller, PATCH, POST } from "fastify-decorators";
import { LogService } from "@services/LogService";
import { Authenticate } from "@middleware/Authenticate";
import { FastifyReply, FastifyRequest } from "fastify";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { PermissionResource } from "@enums/PermissionResource";
import { LogPaginateBodyInputSchema, LogPaginateDTO } from "@DTOs/log/LogQueryDTO";
import { exz } from "@utils/helpers/exz";

@Controller({
    route: "/logs",
    tags: [{ name: "Logs", description: "Logs retrieving" }],
})
export class LogController {

    constructor( private readonly logService: LogService) {
    }

    @POST("/", {
        schema: {
            operationId: "paginateLogs",
            summary: "Paginate Logs",
            body: LogPaginateBodyInputSchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.LOG, PermissionScope.ALL),
        ],
    })
    async paginate(req: FastifyRequest<{ Body: LogPaginateDTO }>,
                   reply: FastifyReply) {
        const { query, options } = req.body;
        reply
            .status(200)
            .send(await this.logService.paginate(query, options));
    }

    @PATCH("/:id/toggle-read", {
        schema: {
            operationId: "toggleReadLogs",
            summary: "Toggle to set read notification",
            params: exz.pathId,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.LOG, PermissionScope.OWN),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        reply
            .status(200)
            .send(await this.logService.toggleRead(+req.params.id, +req.user.id));
    }

    @PATCH("/read-all", {
        schema: {
            operationId: "read-all-by-user",
            summary: "Set all user's notification to read",
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.LOG, PermissionScope.OWN),
        ],
    })
    async readAll(
        req: FastifyRequest,
        reply: FastifyReply
    ) {
        reply
            .status(200)
            .send(await this.logService.setAllReadByUser(+req.user.id));
    }

}
