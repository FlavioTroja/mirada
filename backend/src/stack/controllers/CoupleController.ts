import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { CoupleService } from "@services/CoupleService";
import { CoupleCreateDTO, CoupleCreateSchema } from "@DTOs/couple/CoupleCreateDTO";
import { CoupleUpdateDTO, CoupleUpdateSchema } from "@DTOs/couple/CoupleUpdateDTO";
import { CouplePaginateBodyInputSchema, CouplePaginateDTO } from "@DTOs/couple/CoupleQueryDTO";

/**
 * `Couple` — §4.10. Non porta riferimenti alle iscrizioni: sono le
 * `Registration` a puntare alla coppia, così il grafo resta aciclico.
 */
@Controller({
    route: "/couples",
    tags: [{ name: "Couples", description: "Couple registrations" }],
})
export class CoupleController {
    constructor(private readonly coupleService: CoupleService) {}

    @POST("/create", {
        schema: {
            operationId: "createCouple",
            summary: "Create Couple",
            description: "Creates a couple and links exactly two registrations of the same event with complementary assigned roles.",
            body: CoupleCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.COUPLE, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: CoupleCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.coupleService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findCouple",
            summary: "Get Couple from id",
            description: "Returns a single couple by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.COUPLE, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.coupleService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateCouple",
            summary: "Paginate Couple",
            description: "Returns a filtered and paginated list of couples, restricted to the caller's scope.",
            body: CouplePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.COUPLE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: CouplePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as CouplePaginateDTO;
        reply.status(200).send(await this.coupleService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateCouple",
            summary: "Update Couple from id",
            description: "Partially updates the couple's own scalar fields. Dissolution has its own endpoint because it has a rule of its own.",
            params: exz.pathId,
            body: CoupleUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.COUPLE, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: CoupleUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.coupleService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @POST("/:id/dissolve", {
        schema: {
            operationId: "dissolveCouple",
            summary: "Dissolve a Couple",
            description: "Unlinks the two registrations. Moves NO quota consumption: both dancers stay in with their role and their seat — only the bond falls (05-modello-capienza §8, case T21).",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.COUPLE, PermissionScope.SINGLE),
        ],
    })
    async dissolve(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.coupleService.dissolve(+req.user.id, +req.params.id));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteCouple",
            summary: "Delete Couple by id",
            description: "Soft deletes the couple. Refused while registrations are still linked: it must be dissolved first.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.COUPLE, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.coupleService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
