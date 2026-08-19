import { FastifyReply, FastifyRequest } from "fastify";
import { Controller, DELETE, POST } from "fastify-decorators";
import { Authenticate } from "@middleware/Authenticate";
import { HasPermission } from "@middleware/HasPermission";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionResource } from "@enums/PermissionResource";
import { PermissionScope } from "@enums/PermissionScope";
import { exz } from "@utils/helpers/exz";
import { OrganizationInvitationService } from "@services/OrganizationInvitationService";
import {
    OrganizationInvitationCreateDTO,
    OrganizationInvitationCreateSchema,
} from "@DTOs/organization_invitation/OrganizationInvitationCreateDTO";
import {
    OrganizationInvitationPaginateBodyInputSchema,
    OrganizationInvitationPaginateDTO,
} from "@DTOs/organization_invitation/OrganizationInvitationQueryDTO";

/**
 * Inviti a entrare in un'organizzazione.
 *
 * Il permesso dichiarato qui è la soglia; la regola vera — **titolare di
 * QUELLA organizzazione** — la applica il servizio, perché è una condizione sul
 * dato e non sul ruolo, e il motore dei permessi non la sa esprimere.
 */
@Controller({
    route: "/organization-invitations",
    tags: [{ name: "OrganizationInvitations", description: "Inviti a entrare in un'organizzazione" }],
})
export class OrganizationInvitationController {
    constructor(private readonly organizationInvitationService: OrganizationInvitationService) {}

    @POST("/create", {
        schema: {
            operationId: "createOrganizationInvitation",
            summary: "Invite another owner into an organization",
            description:
                "Issues a single-use, expiring invitation and emails the link. Only an OWNER of that very "
                + "organization may call it. The database stores the token's fingerprint, never the token: the "
                + "original exists only inside the emailed link.",
            body: OrganizationInvitationCreateSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.CREATE, PermissionResource.ORGANIZATION_MEMBER, PermissionScope.ALL),
        ],
    })
    async create(req: FastifyRequest<{ Body: OrganizationInvitationCreateDTO }>, reply: FastifyReply) {
        reply.status(200).send(await this.organizationInvitationService.save(+req.user.id, req.body));
    }

    @POST("/", {
        schema: {
            operationId: "paginateOrganizationInvitations",
            summary: "Paginate invitations",
            description:
                "Paginated list of the invitations belonging to the caller's organization scope. "
                + "'soloAperti' keeps only the ones still spendable — neither accepted, revoked nor expired.",
            body: OrganizationInvitationPaginateBodyInputSchema,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.READ, PermissionResource.ORGANIZATION_MEMBER, PermissionScope.ALL),
        ],
    })
    async paginate(req: FastifyRequest<{ Body: OrganizationInvitationPaginateDTO }>, reply: FastifyReply) {
        const { query, options } = req.body as OrganizationInvitationPaginateDTO;
        reply.status(200).send(await this.organizationInvitationService.paginate(+req.user.id, query, options));
    }

    @DELETE("/:id", {
        schema: {
            operationId: "revokeOrganizationInvitation",
            summary: "Revoke an invitation",
            description:
                "Marks the invitation as revoked so its link stops working. The row is kept, not deleted: "
                + "'who invited whom, and then changed their mind' is a question asked afterwards.",
            params: exz.pathId,
            security: [{ apiKey: [] }],
        },
        onRequest: [
            Authenticate(),
            HasPermission(PermissionAction.DELETE, PermissionResource.ORGANIZATION_MEMBER, PermissionScope.ALL),
        ],
    })
    async revoke(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        reply.status(200).send(await this.organizationInvitationService.revoke(+req.user.id, +req.params.id));
    }
}
