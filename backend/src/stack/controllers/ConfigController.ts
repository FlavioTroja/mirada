import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { ConfigService } from "@services/ConfigService";
import { UiScope } from "@prisma/client";
import { ConfigQueryDTO, ConfigQuerySchema } from "@DTOs/config/ConfigQueryDTO";

@Controller({
    route: "/configs",
    tags: [{ name: "Configs", description: "Config management" }],
})
export class ConfigController {
    constructor(private readonly configService: ConfigService) {}

    @POST("/all/visible", {
        schema: {
            operationId: "allVisibleConfig",
            summary: "All visible config",
            body: ConfigQuerySchema,
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
        ],
    })
    async findMany(
        req: FastifyRequest<{ Body: ConfigQueryDTO }>,
        reply: FastifyReply
    ) {
        reply
            .status(200)
            .send(await this.configService.findAllByScopes(req.body, [ UiScope.VISIBLE ]));
    }
}
