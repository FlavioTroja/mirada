import { FastifyReply, FastifyRequest } from "fastify";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { hasPermissionOrThrow } from "@utils/adapters/permission";
import { PermissionRequestDTO } from "@DTOs/permission/PermissionRequestDTO";
import { PermissionResource } from "@enums/PermissionResource";

export function HasPermission(action: PermissionAction, entity: PermissionResource, scope: PermissionScope) {
    return async function (req: FastifyRequest, _reply: FastifyReply) {

        const permissionRequestDto: PermissionRequestDTO = { action, entity, scope };

        await hasPermissionOrThrow(req.user.id, permissionRequestDto);

    };
}
