import type { AuditLogParams } from "./AuditLog";
// AuditLogParams imported as type-only to avoid runtime circular dependency.

export type AspectContext<TArgs extends any[] = any[], TReturn = any> = {
    params: AuditLogParams;
    methodName: string;
    target: object;
    functionParams: TArgs;
    paramNames: string[];
    returnValue?: TReturn;
    error?: Error;
};
