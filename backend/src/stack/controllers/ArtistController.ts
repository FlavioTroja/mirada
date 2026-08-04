import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { ArtistService } from "@services/ArtistService";
import { ArtistCreateDTO, ArtistCreateSchema } from "@DTOs/artist/ArtistCreateDTO";
import { ArtistUpdateDTO, ArtistUpdateSchema } from "@DTOs/artist/ArtistUpdateDTO";
import { ArtistPaginateBodyInputSchema, ArtistPaginateDTO } from "@DTOs/artist/ArtistQueryDTO";

/**
 * Ogni rotta porta il principale al servizio: l'isolamento fra organizzazioni
 * (§1.5) è realizzato dal filtro obbligatorio nei finder di repository, non dal
 * solo controllo di permesso.
 */
@Controller({
    route: "/artists",
    tags: [{ name: "Artists", description: "Artist management" }],
})
export class ArtistController {
    constructor(private readonly artistService: ArtistService) {}

    @POST("/create", {
        schema: {
            operationId: "createArtist",
            summary: "Create Artist",
            description: "Creates a new artist inside the caller's organization scope.",
            body: ArtistCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.ARTIST, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: ArtistCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.artistService.save(+req.user.id, req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findArtist",
            summary: "Get Artist from id",
            description: "Returns a single artist by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ARTIST, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.artistService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateArtist",
            summary: "Paginate Artist",
            description: "Returns a filtered and paginated list of artists, restricted to the caller's scope.",
            body: ArtistPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ARTIST, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: ArtistPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as ArtistPaginateDTO;
        reply.status(200).send(await this.artistService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateArtist",
            summary: "Update Artist from id",
            description: "Partially updates the artist's own scalar fields.",
            params: exz.pathId,
            body: ArtistUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.ARTIST, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: ArtistUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.artistService.updateById(+req.user.id, +req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteArtist",
            summary: "Delete Artist by id",
            description: "Soft deletes the artist.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.ARTIST, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.artistService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
