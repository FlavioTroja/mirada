import { RoleName } from "@prisma/client";
import { UserWithRelations } from "@prisma-gen/zod";

export function hasRole(user: UserWithRelations, role: RoleName) {
    return user.roles.some(r => r.roleName === role);
}

// export function isOperator(user: CompleteUser) {
//     return hasRole(user, RoleName.OPERATOR);
// }
//
// export function isTutor(user: CompleteUser) {
//     return hasRole(user, RoleName.TUTOR);
// }
//
// export function isNonAdministrative(user: CompleteUser) {
//     return isOperator(user) || isTutor(user);
// }

export function usernameFromFullName(name: string, surname: string): string {
    return `${name.trim().toLowerCase()}.${surname.trim().toLowerCase()}`.replace(/'/g, "").replace(/\s/g, ".");
}