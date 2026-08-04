import { Level, RoleName } from "@prisma/client";
import { RecipientDTO } from "@DTOs/log/RecipientDTO";

export type LogPlainDTO = {
    level: Level;
    description?: string;
    entityName?: string | null;
    entityId?: number | null;
    input?: unknown;
    output?: unknown;
    actionById?: number | null;
    actionByUsername?: string | null;
    hasError?: boolean;
    toRoles?: RoleName[];
    isNotification?: boolean;
    recipients?: RecipientDTO[];
};
