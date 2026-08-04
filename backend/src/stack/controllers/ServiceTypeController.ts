import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import httpErrors from "http-errors";
import { ServiceTypeService } from "@services/ServiceTypeService";
import { ServiceTypeCreateDTO, ServiceTypeCreateSchema } from "@DTOs/service_type/ServiceTypeCreateDTO";
import { ServiceTypeUpdateDTO, ServiceTypeUpdateSchema } from "@DTOs/service_type/ServiceTypeUpdateDTO";
import { ServiceTypePaginateBodyInputSchema, ServiceTypePaginateDTO } from "@DTOs/service_type/ServiceTypeQueryDTO";

/**
 * Catalogo di piattaforma (§4.1): la scrittura è riservata a `GOD`
 * (`EVERYTHING#SERVICE_TYPE#EVERYTHING`), la lettura è `READ#SERVICE_TYPE#ALL`
 * per ogni ruolo autenticato.
 */
@Controller({
    route: "/service-types",
    tags: [{ name: "ServiceTypes", description: "ServiceType catalogue management" }],
})
export class ServiceTypeController {
    constructor(private readonly serviceTypeService: ServiceTypeService) {}

    @POST("/create", {
        schema: {
            operationId: "createServiceType",
            summary: "Create ServiceType",
            description: "Creates a new service type. Platform catalogue, reserved to GOD.",
            body: ServiceTypeCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.EVERYTHING, PermissionResource.SERVICE_TYPE, PermissionScope.EVERYTHING),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: ServiceTypeCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.serviceTypeService.save(req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findServiceType",
            summary: "Get ServiceType from id",
            description: "Returns a single service type by id.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.SERVICE_TYPE, PermissionScope.ALL),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.serviceTypeService.findById(+req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateServiceType",
            summary: "Paginate ServiceType",
            description: "Returns a filtered and paginated list of service types.",
            body: ServiceTypePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.SERVICE_TYPE, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: ServiceTypePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as ServiceTypePaginateDTO;
        reply.status(200).send(await this.serviceTypeService.paginate(query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateServiceType",
            summary: "Update ServiceType from id",
            description: "Partially updates the service type's own scalar fields. Platform catalogue, reserved to GOD.",
            params: exz.pathId,
            body: ServiceTypeUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.EVERYTHING, PermissionResource.SERVICE_TYPE, PermissionScope.EVERYTHING),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: ServiceTypeUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.serviceTypeService.updateById(+req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteServiceType",
            summary: "Delete ServiceType by id",
            description: "Soft deletes the service type. Platform catalogue, reserved to GOD.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.EVERYTHING, PermissionResource.SERVICE_TYPE, PermissionScope.EVERYTHING),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.serviceTypeService.safeDeleteById(+req.params.id));
    }
}
