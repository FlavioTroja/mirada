import { z } from "zod";
import { RoleNameSchema } from "@prisma-gen/zod";

/**
 * Payload del JWT — backend-brief §3.1.
 *
 * > «Il payload del token è **minimo**: `{ id, username, wsCode, roles }` e nulla
 * > più. Il template firmava `{ ...user }`, cioè l'intera riga utente compreso
 * > l'hash bcrypt della password.»
 *
 * Un payload JWT è **base64, non cifrato**: sta in `localStorage` e viaggia a ogni
 * richiesta. Tutto ciò che finisce qui è pubblico. Nessun campo va aggiunto senza
 * che il §3.1 lo dichiari.
 *
 * `roles` porta le sole due colonne che il consumatore usa davvero — il nome del
 * ruolo e il flag di attivazione — ed è la stessa forma che `GET /auth/profile`
 * espone al frontend (`ProfileRole`).
 */
export const AuthTokenRoleSchema = z.object({
    roleName: RoleNameSchema,
    isActive: z.boolean(),
});
export type AuthTokenRoleDTO = z.infer<typeof AuthTokenRoleSchema>;

export const AuthTokenPayloadSchema = z.object({
    id: z.number().int(),
    username: z.string(),
    wsCode: z.string().nullable(),
    roles: AuthTokenRoleSchema.array(),
});
export type AuthTokenPayloadDTO = z.infer<typeof AuthTokenPayloadSchema>;
