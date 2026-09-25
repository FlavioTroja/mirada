import { AsyncLocalStorage } from "node:async_hooks";
import { PermissionRequestDTO } from "@DTOs/permission/PermissionRequestDTO";

export type RequestContext = {
    actorId?: number;
    actorUsername?: string;
    /**
     * I permessi che la rotta ha dichiarato con `HasPermission`, e che il
     * chiamante ha superato. `OrganizationScopeService.resolve` li usa per
     * restringere lo scope alle sole organizzazioni in cui **quel** permesso è
     * concesso dal ruolo che vi si ricopre (vedi lì).
     */
    permissions?: PermissionRequestDTO[];
};

export const requestStorage = new AsyncLocalStorage<RequestContext>();

export const currentActor = (): RequestContext | undefined => requestStorage.getStore();
