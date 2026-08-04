import { PermissionAction } from "@enums/PermissionAction";
import { PermissionScope } from "@enums/PermissionScope";
import { PermissionResource } from "@enums/PermissionResource";

export interface PermissionRequestDTO {
    action: PermissionAction,
    entity: PermissionResource,
    scope: PermissionScope,
}
