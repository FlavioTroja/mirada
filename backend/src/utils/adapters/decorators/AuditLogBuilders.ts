import { Level } from "@prisma/client";
import { LogPlainDTO } from "@DTOs/log/LogPlainDTO";
import { italianModelName } from "@utils/helpers/modelNameItalian";
import { AspectContext } from "./AspectContext";
import { LogOp } from "./LogOp";

const resolveEntityId = (
    ctx: AspectContext,
    idFallbackFromArgs?: (args: any[]) => any,
): number | null => {
    const explicit = ctx.params.entityIdFrom?.(ctx);
    if (explicit !== undefined && explicit !== null) return explicit;
    const fromReturn = (ctx.returnValue as any)?.id;
    if (typeof fromReturn === "number") return fromReturn;
    const fromArgs = idFallbackFromArgs?.(ctx.functionParams);
    return typeof fromArgs === "number" ? fromArgs : null;
};

const resolveDescription = (ctx: AspectContext, fallback: string): string => {
    const d = ctx.params.description;
    if (typeof d === "function") return d(ctx);
    return d ?? fallback;
};

type Builder = (ctx: AspectContext) => LogPlainDTO;

/** Build `{ method, input: { <paramName>: <argValue>, ... } }` from the current call. */
const defaultInput = (ctx: AspectContext) => {
    const named: Record<string, unknown> = {};
    ctx.functionParams.forEach((value, i) => {
        named[ctx.paramNames[i] ?? `arg${i}`] = value;
    });
    return { method: ctx.methodName, input: named };
};

export const Builders: Record<LogOp, Builder> = {
    [LogOp.CREATE]: ctx => ({
        level: Level.INFO,
        description: resolveDescription(ctx, `Creata un'entità di tipo ${italianModelName(ctx.params.entity)}`),
        entityName: ctx.params.entity,
        entityId: resolveEntityId(ctx),
        input: ctx.params.inputFrom?.(ctx) ?? defaultInput(ctx),
        output: ctx.params.outputFrom?.(ctx) ?? ctx.returnValue ?? null,
    }),

    [LogOp.READ]: ctx => ({
        level: Level.INFO,
        description: resolveDescription(ctx, `Letta un'entità di tipo ${italianModelName(ctx.params.entity)}`),
        entityName: ctx.params.entity,
        entityId: resolveEntityId(ctx, args => args[0]),
        input: ctx.params.inputFrom?.(ctx) ?? defaultInput(ctx),
        output: ctx.params.outputFrom?.(ctx) ?? ctx.returnValue ?? null,
    }),

    [LogOp.UPDATE]: ctx => ({
        level: Level.INFO,
        description: resolveDescription(ctx, `Aggiornata un'entità di tipo ${italianModelName(ctx.params.entity)}`),
        entityName: ctx.params.entity,
        entityId: resolveEntityId(ctx, args => args[0]),
        input: ctx.params.inputFrom?.(ctx) ?? defaultInput(ctx),
        output: ctx.params.outputFrom?.(ctx) ?? ctx.returnValue ?? null,
    }),

    [LogOp.DELETE]: ctx => ({
        level: Level.INFO,
        description: resolveDescription(ctx, `Eliminata un'entità di tipo ${italianModelName(ctx.params.entity)}`),
        entityName: ctx.params.entity,
        entityId: resolveEntityId(ctx, args => args[0]),
        input: ctx.params.inputFrom?.(ctx) ?? defaultInput(ctx),
        output: ctx.params.outputFrom?.(ctx) ?? ctx.returnValue ?? null,
    }),

    [LogOp.PAGINATE]: ctx => ({
        level: Level.INFO,
        description: resolveDescription(ctx, `Paginazione su entità di tipo ${italianModelName(ctx.params.entity)}`),
        entityName: ctx.params.entity,
        entityId: null,
        input: ctx.params.inputFrom?.(ctx) ?? defaultInput(ctx),
        output: ctx.params.outputFrom?.(ctx) ?? ctx.returnValue ?? null,
    }),
};

export const errorBuilder = (ctx: AspectContext): LogPlainDTO => ({
    ...Builders[ctx.params.op](ctx),
    level: Level.ERROR,
    hasError: true,
    description: `${italianModelName(ctx.params.entity)} – ${ctx.params.op} fallita: ${ctx.error?.message ?? "errore sconosciuto"}`,
    output: null,
});
