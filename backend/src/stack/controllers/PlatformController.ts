import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET } from "fastify-decorators";
import { RoleName } from "@prisma/client";
import { Authenticate } from "@middleware/Authenticate";
import { HasRole } from "@middleware/HasRole";
import { PlatformSummaryService } from "@services/PlatformSummaryService";
import { PlatformSummarySchema } from "@DTOs/platform/PlatformSummaryDTO";

/**
 * `/platform` — le rotte di **chi gestisce la piattaforma**, non di chi
 * organizza eventi.
 *
 * Chiuse con `HasRole(GOD)` e **non** con un permesso, ed è una scelta
 * deliberata: `READ#ORGANIZATION#ALL` lo possiede anche un `OWNER`, e con quello
 * un titolare leggerebbe gli eventi e gli incassi dei concorrenti. Il §1.5 non
 * concede a un tenant nemmeno un conteggio aggregato di un'organizzazione
 * altrui, quindi la barriera qui è il ruolo, non lo scope.
 */
@Controller({
    route: "/platform",
    tags: [{ name: "Platform", description: "Platform-wide administration (GOD only)" }],
})
export class PlatformController {
    constructor(private readonly platformSummaryService: PlatformSummaryService) {}

    @GET("/summary", {
        schema: {
            operationId: "getPlatformSummary",
            summary: "Platform-wide summary",
            description:
                "Aggregated view across every organization and every event: customers, their owners, "
                + "published events, active registrations and settled revenue. Reserved to GOD.",
            response: { 200: PlatformSummarySchema },
            security: [{ apiKey: [] }],
        },
        onRequest: [Authenticate(), HasRole(RoleName.GOD)],
    })
    async summary(_req: FastifyRequest, reply: FastifyReply) {
        reply.status(200).send(await this.platformSummaryService.build());
    }
}
