import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { RequirementTypeService } from "@services/RequirementTypeService";
import { RequirementTypeCreateDTO, RequirementTypeCreateSchema } from "@DTOs/requirement_type/RequirementTypeCreateDTO";
import { RequirementTypeUpdateDTO, RequirementTypeUpdateSchema } from "@DTOs/requirement_type/RequirementTypeUpdateDTO";
import { RequirementTypePaginateBodyInputSchema, RequirementTypePaginateDTO } from "@DTOs/requirement_type/RequirementTypeQueryDTO";

/**
 * Catalogo di piattaforma (§4.1): la scrittura è riservata a `GOD`
 * (`EVERYTHING#REQUIREMENT_TYPE#EVERYTHING`), la lettura è `READ#REQUIREMENT_TYPE#ALL`
 * per ogni ruolo autenticato.
 */
@Controller({
    route: "/requirement-types",
    tags: [{ name: "RequirementTypes", description: "RequirementType catalogue management" }],
})
export class RequirementTypeController {
    constructor(private readonly requirementTypeService: RequirementTypeService) {}

    @POST("/create", {
        schema: {
            operationId: "createRequirementType",
            summary: "Create RequirementType",
            description: "Creates a new requirement type. Platform catalogue, reserved to GOD.",
            body: RequirementTypeCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.EVERYTHING, PermissionResource.REQUIREMENT_TYPE, PermissionScope.EVERYTHING),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: RequirementTypeCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.requirementTypeService.save(req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findRequirementType",
            summary: "Get RequirementType from id",
            description: "Returns a single requirement type by id.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.REQUIREMENT_TYPE, PermissionScope.ALL),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.requirementTypeService.findById(+req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateRequirementType",
            summary: "Paginate RequirementType",
            description: "Returns a filtered and paginated list of requirement types.",
            body: RequirementTypePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.REQUIREMENT_TYPE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: RequirementTypePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as RequirementTypePaginateDTO;
        reply.status(200).send(await this.requirementTypeService.paginate(query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateRequirementType",
            summary: "Update RequirementType from id",
            description: "Partially updates the requirement type's own scalar fields. Platform catalogue, reserved to GOD.",
            params: exz.pathId,
            body: RequirementTypeUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.EVERYTHING, PermissionResource.REQUIREMENT_TYPE, PermissionScope.EVERYTHING),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: RequirementTypeUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.requirementTypeService.updateById(+req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteRequirementType",
            summary: "Delete RequirementType by id",
            description: "Soft deletes the requirement type. Platform catalogue, reserved to GOD.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.EVERYTHING, PermissionResource.REQUIREMENT_TYPE, PermissionScope.EVERYTHING),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.requirementTypeService.safeDeleteById(+req.params.id));
    }
}
