import { FastifyReply, FastifyRequest } from "fastify";
import httpErrors from "http-errors";
import { RoleName } from "@prisma/client";

/**
 * La forma dei ruoli **come viaggiano nel token** (§3.1 del backend-brief):
 * righe `RoleToUser`, che portano `roleName`, non il modello Prisma `Role`,
 * che porta `name`.
 *
 * Il template annotava questi elementi come `Role` e leggeva `r.name`: il tipo
 * mentiva sul valore, quindi il confronto era sempre `undefined` e **ogni rotta
 * protetta da `HasRole` rispondeva 403 a chiunque**, corto circuito su `GOD`
 * compreso. L'annotazione sbagliata è ciò che ha tenuto nascosto il difetto.
 * Da correggere a monte nel template.
 */
type TokenRole = { roleName: RoleName; isActive?: boolean | null };

export function HasRole(...roles: RoleName[]) {
    return async function (req: FastifyRequest, _: FastifyReply) {
        if (!req.user || !req.user.roles || req.user.roles.length === 0) {
            throw new httpErrors.Unauthorized("Ruoli dell'utente non trovati o utente non autenticato.");
        }

        const userRoles: TokenRole[] = req.user.roles;

        if (userRoles.some(r => r.roleName === RoleName.GOD)) {
            // God role is always allowed
            return;
        }

        const hasRole = userRoles.some(r => roles.includes(r.roleName));
        if (!hasRole) {
            throw new httpErrors.Forbidden(
                `L'utente non dispone di uno dei ruoli necessari: ${roles.join(", ")}. `
                + `L'utente presenta i seguenti ruoli: ${userRoles.map(r => r.roleName).join(", ")}.`
            );
        }
    };
}
