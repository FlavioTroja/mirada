import { getPrismaClient, mapPrismaErrorToHttpError } from "@utils/adapters/prisma";
import { RoleName } from "@prisma/client";
import { LOGGER } from "@utils/adapters/winston";
import httpErrors from "http-errors";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { PermissionRequestDTO } from "@DTOs/permission/PermissionRequestDTO";

export async function hasPermissionOrThrow(userId: number, requestedPermission: PermissionRequestDTO) {

    const REQUESTED_PERMISSION = `${requestedPermission.action}#${requestedPermission.entity}#${requestedPermission.scope}`;
    const result = await hasPermission(userId, requestedPermission);
    if (!result) {
        const message = `User ${userId} lacks ${REQUESTED_PERMISSION} permission`;
        LOGGER.warn(message);
        throw new httpErrors.Forbidden(message);
    }

}

export async function hasPermission(userId: number, requestedPermission: PermissionRequestDTO): Promise<boolean> {
    const userRoles = await extractRolesFromUser(userId);

    if (userRoles.includes(RoleName.GOD)) return true;

    const REQUESTED_PERMISSION = `${requestedPermission.action}#${requestedPermission.entity}#${requestedPermission.scope}`;

    const permissionConfiguration = await extractPermissionConfig(userRoles);

    return permissionConfiguration.includes(REQUESTED_PERMISSION);
}

/**
 * True when the user carries the GOD role. GOD is the implicit allow-all of the
 * platform (backend-brief §3.8) and is the only principal exempted from the
 * mandatory `organizationId` tenancy filter of §1.5.
 */
export async function isGod(userId: number): Promise<boolean> {
    const userRoles = await extractRolesFromUser(userId);
    return userRoles.includes(RoleName.GOD);
}

async function extractRolesFromUser(userId: number) {

    let roles;
    try {
        roles = await getPrismaClient().roleToUser.findMany( { where: { AND: [{ userId: userId }, { isActive: true }, ] } });
    } catch (err) {
        throw mapPrismaErrorToHttpError(err as PrismaClientKnownRequestError);
    }

    return roles.map(role => role.roleName);
}

async function extractPermissionConfig(userRoles: Array<String>): Promise<String[]> {

    let permissions = [];
    try {
        permissions = await getPrismaClient().permissionConfig.findMany({
            where: {
                roleName: {
                    in: userRoles as unknown as RoleName[]
                }
            },
            distinct: ['action', 'entity', 'scope'],
        })
    } catch (err) {
        throw mapPrismaErrorToHttpError(err as PrismaClientKnownRequestError);
    }
    return permissions.map(c => `${c.action}#${c.entity}#${c.scope}`);
}
