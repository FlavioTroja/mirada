import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, GET, PATCH, POST } from "fastify-decorators";
import httpErrors from "http-errors";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz, FindOptions } from "@utils/helpers/exz";
import { RequirementOutcomeService } from "@services/RequirementOutcomeService";
import {
    RequirementOutcomeCreateDTO,
    RequirementOutcomeCreateSchema,
} from "@DTOs/requirement_outcome/RequirementOutcomeCreateDTO";
import {
    RequirementOutcomeUpdateDTO,
    RequirementOutcomeUpdateSchema,
} from "@DTOs/requirement_outcome/RequirementOutcomeUpdateDTO";
import {
    RequirementOutcomePaginateBodyInputSchema,
    RequirementOutcomePaginateDTO,
} from "@DTOs/requirement_outcome/RequirementOutcomeQueryDTO";

/**
 * `RequirementOutcome` — §4.10.
 *
 * `acceptedAt`, `acceptedIp` e `acceptedVersion` sono **calcolati dal server**
 * (`RF-REQ-4`): l'indirizzo arriva dal trasporto, non dal corpo. È l'unico punto
 * del controller in cui si legge qualcosa dalla richiesta oltre al token, ed è
 * deliberato — una prova che il client dichiara su se stesso non prova nulla.
 */
@Controller({
    route: "/requirement-outcomes",
    tags: [{ name: "RequirementOutcomes", description: "Per-registration outcome of the event requirements" }],
})
export class RequirementOutcomeController {
    constructor(private readonly requirementOutcomeService: RequirementOutcomeService) {}

    @POST("/create", {
        schema: {
            operationId: "createRequirementOutcome",
            summary: "Record a requirement outcome",
            description: "Records the declaration of a registrant on an event requirement. `acceptedAt`, `acceptedIp` and `acceptedVersion` are stamped by the server (RF-REQ-4). The initial status follows the requirement's verification mode: AUTOMATIC counts as accepted, MANUAL enters UNDER_REVIEW and keeps blocking.",
            body: RequirementOutcomeCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.REQUIREMENT_OUTCOME, PermissionScope.ALL),
        ],
    })
    async create(
        req: FastifyRequest<{ Body: RequirementOutcomeCreateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(
            await this.requirementOutcomeService.save(+req.user.id, req.body, req.ip),
        );
    }

    @GET("/:id", {
        schema: {
            operationId: "findRequirementOutcome",
            summary: "Get RequirementOutcome from id",
            description: "Returns a single requirement outcome by id, restricted to the caller's scope.",
            params: exz.pathId,
            querystring: exz.findOptions,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.REQUIREMENT_OUTCOME, PermissionScope.SINGLE),
        ],
    })
    async getById(
        req: FastifyRequest<{ Params: { id: string }, Querystring: FindOptions }>,
        reply: FastifyReply,
    ) {
        const entity = await this.requirementOutcomeService.findById(+req.user.id, +req.params.id, req.query);
        if (!entity) {
            throw new httpErrors.NotFound();
        }
        reply.status(200).send(entity);
    }

    @POST("/", {
        schema: {
            operationId: "paginateRequirementOutcome",
            summary: "Paginate RequirementOutcome",
            description: "Returns a filtered and paginated list of requirement outcomes, restricted to the caller's scope.",
            body: RequirementOutcomePaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.REQUIREMENT_OUTCOME, PermissionScope.ALL),
        ],
    })
    async paginate(
        req: FastifyRequest<{ Body: RequirementOutcomePaginateDTO }>,
        reply: FastifyReply,
    ) {
        const { query, options } = req.body as RequirementOutcomePaginateDTO;
        reply.status(200).send(await this.requirementOutcomeService.paginate(+req.user.id, query, options));
    }

    @PATCH("/:id", {
        schema: {
            operationId: "updateRequirementOutcome",
            summary: "Update RequirementOutcome from id",
            description: "Carries the review decision (status, rejectionReason) and the declared value. `reviewedByUserId` and `reviewedAt` are stamped by the server when the status becomes VALID or REJECTED: an outcome approved without a reviewer is an outcome nobody approved.",
            params: exz.pathId,
            body: RequirementOutcomeUpdateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.UPDATE, PermissionResource.REQUIREMENT_OUTCOME, PermissionScope.SINGLE),
        ],
    })
    async updateById(
        req: FastifyRequest<{ Params: { id: string }, Body: RequirementOutcomeUpdateDTO }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(
            await this.requirementOutcomeService.updateById(+req.user.id, +req.params.id, req.body),
        );
    }

    @DELETE("/:id", {
        schema: {
            operationId: "deleteRequirementOutcome",
            summary: "Delete RequirementOutcome by id",
            description: "Soft deletes the requirement outcome.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.REQUIREMENT_OUTCOME, PermissionScope.SINGLE),
        ],
    })
    async deleteById(
        req: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        reply.status(200).send(await this.requirementOutcomeService.safeDeleteById(+req.user.id, +req.params.id));
    }
}
