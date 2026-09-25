import { FastifyReply, FastifyRequest } from "fastify";
import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { hasPermissionOrThrow } from "@utils/adapters/permission";
import { PermissionRequestDTO } from "@DTOs/permission/PermissionRequestDTO";
import { PermissionResource } from "@enums/PermissionResource";

declare module "fastify" {
    interface FastifyRequest {
        /**
         * I permessi dichiarati dalla rotta e superati. Il `preHandler` di
         * `server.ts` li porta nel contesto della richiesta: `onRequest` gira
         * **prima** che quel contesto esista, e non può scriverci direttamente.
         */
        declaredPermissions?: PermissionRequestDTO[];
    }
}

export function HasPermission(action: PermissionAction, entity: PermissionResource, scope: PermissionScope) {
    return async function (req: FastifyRequest, _reply: FastifyReply) {

        const permissionRequestDto: PermissionRequestDTO = { action, entity, scope };

        await hasPermissionOrThrow(req.user.id, permissionRequestDto);

        req.declaredPermissions = [...(req.declaredPermissions ?? []), permissionRequestDto];
    };
}
