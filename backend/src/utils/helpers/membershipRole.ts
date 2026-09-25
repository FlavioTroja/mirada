import { OrgMemberRole, RoleName } from "@prisma/client";

/**
 * Il ruolo di piattaforma (`RoleName`) che corrisponde al ruolo di
 * un'appartenenza (`OrgMemberRole`).
 *
 * È la corrispondenza fra i due enum scritta a mano invece che con un cast.
 * Hanno gli stessi nomi **oggi**: se `OrgMemberRole` ne guadagnasse uno, un cast
 * lo lascerebbe passare in silenzio, mentre questa mappa fa fallire la
 * compilazione.
 *
 * Serve in due posti, ed è per questo che non vive dentro un servizio:
 * `OrganizationMemberService` la usa per tenere allineato `RoleToUser`, e
 * `OrganizationScopeService` per sapere **in quale organizzazione** un ruolo
 * concede un permesso.
 */
export const ROLE_OF_MEMBERSHIP: Record<OrgMemberRole, RoleName> = {
    [OrgMemberRole.OWNER]: RoleName.OWNER,
    [OrgMemberRole.EVENT_MANAGER]: RoleName.EVENT_MANAGER,
    [OrgMemberRole.BOX_OFFICE]: RoleName.BOX_OFFICE,
    [OrgMemberRole.CHECKIN_OPERATOR]: RoleName.CHECKIN_OPERATOR,
};

/** I soli ruoli di piattaforma che un'appartenenza giustifica. */
export const MEMBERSHIP_ROLES: RoleName[] = Object.values(ROLE_OF_MEMBERSHIP);
