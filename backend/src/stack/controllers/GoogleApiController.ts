import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, GET, POST } from "fastify-decorators";
import { z } from "zod";
import { GoogleMapsApiService } from "@services/GoogleApiService";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { PermissionResource } from "@enums/PermissionResource";
import {
    GoogleMapsApiRetrievePlacesDTO,
    GoogleMapsApiRetrievePlacesSchema
} from "@DTOs/google_maps/GoogleMapsApiRetrievePlacesDTO";

@Controller({
    route: "/google-api",
    tags: [{ name: "Google Maps", description: "Google maps api management" }],
})
export class GoogleMapsApiController {
    constructor(private readonly googleMapsApiService: GoogleMapsApiService) {}

    @POST("/places", {
        schema: {
            operationId: "retrievePlaces",
            summary: "Retrieve places Google",
            body: GoogleMapsApiRetrievePlacesSchema,
            response: {
                200: z.any().describe("Retrieve places from Google maps"),
            },
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.GOOGLE_API, PermissionScope.ALL),
        ],
    })
    async retrieveAddress(
        req: FastifyRequest<{ Body: GoogleMapsApiRetrievePlacesDTO }>,
        reply: FastifyReply
    ) {


        reply
            .status(200)
            .send(await this.googleMapsApiService.retrievePlaces(req.body.searchAddress));
    }

    @GET("/detail-address", {
        schema: {
            operationId: "getDetailAddress",
            summary: "Get detail address",
            querystring: z.object({
                placeId: z.coerce.string().describe("Google Maps place Id"),
            }),
            response: {
                200: z.any().describe("get detail address"),
            },
            security: [
                {
                    apiKey: []
                }
            ],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.GOOGLE_API, PermissionScope.ALL),
        ],
    })
    async getFormattedAddress(
        req: FastifyRequest<{ Querystring: { placeId: string } }>,
        reply: FastifyReply
    ) {


        reply
            .status(200)
            .send(await this.googleMapsApiService.getDetailAddress(req.query.placeId));
    }
}
