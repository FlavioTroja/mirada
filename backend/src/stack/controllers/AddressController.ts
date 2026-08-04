import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import { FastifyReply, FastifyRequest } from "fastify";
import httpErrors from "http-errors";
import { AddressService } from "@services/AddressService";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { AddressCreateDTO, AddressCreateSchema } from "@DTOs/address/AddressCreateDTO";
import { AddressUpdateDTO, AddressUpdateSchema } from "@DTOs/address/AddressUpdateDTO";
import { AddressPaginateBodyInputSchema, AddressPaginateDTO } from "@DTOs/address/AddressQueryDTO";

/**
 * `Address` è una delle **due eccezioni della foundation** del §3.4: il template
 * spediva il solo `GET /addresses/cities`, ma `Venue.addressId` è obbligatorio e
 * senza creazione una location non è creabile. I cinque verbi del dialetto §3.2
 * portano i **permessi di `VENUE`**, come il §3.4 prescrive.
 */
@Controller({
    route: "/addresses",
    tags: [{ name: "Addresses", description: "Addresses endpoints" }],
})
export class AddressController {

    constructor( private readonly addressService: AddressService) {
    }

    @GET("/cities", {
        schema: {
            operationId: "distinctCities",
            summary: "Retrieve distinct cities",
            description: "Returns the distinct, normalized list of the cities that appear on the stored addresses.",
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
    async distinctCities(req: FastifyRequest,
                   reply: FastifyReply) {
        reply
            .status(200)
            .send(await this.addressService.findDistinctCities());
    }

    @POST("/create", {
        schema: {
            operationId: "createAddress",
            summary: "Create Address",
            description: "Creates an address. It is the prerequisite of a venue: Venue.addressId is mandatory.",
            body: AddressCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.ADDRESS, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: AddressCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.addressService.save(req.body));
    }

    @GET("/:id", {
        schema: {
            operationId: "findAddress",
            summary: "Get Address from id",
            description: "Returns a single address by id.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ADDRESS, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.addressService.findById(+req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateAddress",
            summary: "Paginate Address",
            description: "Returns a filtered and paginated list of addresses.",
            body: AddressPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ADDRESS, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: AddressPaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as AddressPaginateDTO;
        reply.status(200).send(await this.addressService.paginate(query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateAddress",
            summary: "Update Address from id",
            description: "Partially updates the address' own scalar fields.",
            params: exz.pathId,
            body: AddressUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.ADDRESS, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: AddressUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.addressService.updateById(+req.params.id, req.body));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteAddress",
            summary: "Delete Address by id",
            description: "Deletes the address. Address is the only entity of the dialect without a 'deleted' column, so the deletion is real; an address still referenced by a venue or by an organization is refused with 400.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.ADDRESS, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.addressService.deleteById(+req.params.id));
    }

}
