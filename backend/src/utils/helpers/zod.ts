import { z, ZodRawShape } from "zod";

export function whereInputSchema<T extends ZodRawShape>(schema: z.ZodObject<T>): z.ZodType {
    return schema.extend({
        AND: z.union([ z.lazy(() => whereInputSchema(schema)),z.lazy(() => whereInputSchema(schema)).array() ]).optional(),
        OR: z.lazy(() => whereInputSchema(schema)).array().optional(),
        NOT: z.union([ z.lazy(() => whereInputSchema(schema)),z.lazy(() => whereInputSchema(schema)).array() ]).optional(),
    }).strict();
}

/**
 * Questa funzione mappa l'ogetto passato in input con il coerce di zod.
 * In genere si usa per le date, serve a parsare la data in stringa o viceversa.
 * @param schema
 * @param fields
 */
export function extendCoerceFields<T extends ZodRawShape>(schema: z.ZodObject<T>, fields: { name: string, type: string }[]) {
    return schema.extend(fields.reduce((acc, {name, type}) => ({
        ...acc,
        [name]: getTypeFromField(type)
    }), {}));
}

function getTypeFromField(type: string): z.ZodType {
    switch (type) {
        case "date": return z.coerce.date().optional();
        case "number": return z.coerce.number().optional();
        default: return z.any();
    }
}
