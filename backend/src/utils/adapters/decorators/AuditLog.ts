import { Prisma, RoleName } from "@prisma/client";
import { getInstanceByToken } from "fastify-decorators";
import { Log } from "@utils/adapters/log";
import { LogService } from "@services/LogService";
import { currentActor } from "@utils/adapters/requestContext";
import { LogPlainDTO } from "@DTOs/log/LogPlainDTO";
import { LogCreateDTO } from "@DTOs/log/LogCreateDTO";
import { LogCreateAndNotifyDTO } from "@DTOs/log/LogCreateAndNotifyDTO";
import { AspectContext } from "./AspectContext";
import { Builders, errorBuilder } from "./AuditLogBuilders";
import { LogOp } from "./LogOp";

export { LogOp };

export type AuditLogParams = {
    op: LogOp;
    entity: Prisma.ModelName;
    description?: string | ((ctx: AspectContext) => string);
    entityIdFrom?: (ctx: AspectContext) => number | null | undefined;
    inputFrom?: (ctx: AspectContext) => unknown;
    outputFrom?: (ctx: AspectContext) => unknown;
    logOnError?: boolean;
    /**
     * Roles this entry should be delivered to as a notification.
     * Setting this implicitly flags the row as a notification (`isNotification = true`)
     * and notifies the users holding those roles via `LogService.saveAndNotify`.
     */
    toRoles?: RoleName[];
    /**
     * Extra fields to merge into the notification payload produced by
     * `LogService.saveAndNotify`. Only consulted when `toRoles` is set.
     * The payload always carries `level` and `message` from the audit row;
     * anything returned here is spread on top and can override either.
     */
    notificationData?: (ctx: AspectContext) => Record<string, unknown>;
};

export function AuditLog(params: AuditLogParams) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value;
        const paramNames = parseParamNames(original);

        descriptor.value = async function (this: any, ...args: any[]) {
            const baseCtx: AspectContext = {
                params,
                methodName: propertyKey,
                target: this,
                functionParams: args,
                paramNames,
            };

            const stamp = (dto: LogPlainDTO): LogPlainDTO => {
                const actor = currentActor();
                const hasRoles = !!params.toRoles?.length;
                return {
                    ...dto,
                    actionById: actor?.actorId ?? null,
                    actionByUsername: actor?.actorUsername ?? null,
                    toRoles: hasRoles ? params.toRoles : [],
                    isNotification: hasRoles,
                };
            };

            const persist = (dto: LogPlainDTO, ctx: AspectContext) => {
                // Resolve the LogService from the DI container instead of requiring every
                // audited service to inject it
                let service: LogService;
                try {
                    service = getInstanceByToken(LogService);
                } catch (e: any) {
                    Log.warn(`[AuditLog][${target.constructor?.name}.${propertyKey}] LogService not resolvable — skipping audit row: ${e?.message ?? e}`);
                    return;
                }
                const op = params.toRoles?.length
                    ? service.saveAndNotify(dto as unknown as LogCreateAndNotifyDTO, params.notificationData?.(ctx) ?? {})
                    : service.safeSave(dto as unknown as LogCreateDTO);
                Promise.resolve(op)
                    .catch((e: any) => Log.error(`[AuditLog][${propertyKey}] write failed: ${e?.message ?? e}`));
            };

            try {
                const returnValue = await original.apply(this, args);
                const ctx = { ...baseCtx, returnValue };
                persist(stamp(Builders[params.op](ctx)), ctx);
                return returnValue;
            } catch (error: any) {
                if (params.logOnError !== false) {
                    const ctx = { ...baseCtx, error };
                    persist(stamp(errorBuilder(ctx)), ctx);
                }
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Parse parameter names from a function's source so we can label audit-log inputs
 * by argument name. Destructured / rest params fall back to `argN`.
 */
function parseParamNames(fn: Function): string[] {
    const src = fn.toString()
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
    const open = src.indexOf("(");
    if (open < 0) return [];
    let depth = 0;
    let close = -1;
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (c === "(") depth++;
        else if (c === ")") {
            depth--;
            if (depth === 0) { close = i; break; }
        }
    }
    if (close < 0) return [];
    const list = src.slice(open + 1, close);
    return splitTopLevel(list).map((raw, i) => {
        let p = raw.trim();
        if (!p) return `arg${i}`;
        if (p.startsWith("{") || p.startsWith("[")) return `arg${i}`;
        p = p.replace(/^\.\.\./, "");
        const eq = p.indexOf("=");
        if (eq >= 0) p = p.slice(0, eq).trim();
        return p || `arg${i}`;
    });
}

function splitTopLevel(s: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]" || c === "}") depth--;
        else if (c === "," && depth === 0) {
            out.push(s.slice(start, i));
            start = i + 1;
        }
    }
    out.push(s.slice(start));
    return out.filter(p => p.trim().length > 0);
}
