import { z, ZodNullable, ZodObject, ZodRawShape } from "zod";
import { exz } from "@utils/helpers/exz";

type MetadataKeys = 'id' | 'createdAt' | 'updatedAt' | 'deleted';

export const withoutMetadata = <T extends ZodRawShape>(schema: ZodObject<T>) => {
    const { id, createdAt, updatedAt, deleted, ...rest } = schema.shape;
    return z.object(rest as Omit<T, MetadataKeys>);
};

export type WithoutMetadata<T> = Omit<T, MetadataKeys>;


type SchemaOperator = <T extends ZodRawShape>(schema: ZodObject<T>) => ZodObject<any>;

export const schemaCompose = <T extends ZodRawShape>(
    schema: ZodObject<T>,
    ...operators: SchemaOperator[]
) => operators.reduce((acc, op) => op(acc), schema as ZodObject<any>);


type NullableToNullish<T extends ZodRawShape> = {
    [K in keyof T]: T[K] extends ZodNullable<infer U> ? z.ZodOptional<ZodNullable<U>> : T[K];
};

export const nullableToNullish = <T extends ZodRawShape>(schema: ZodObject<T>) => {
    const newShape = {} as { [key: string]: any };
    for (const [key, value] of Object.entries(schema.shape)) {
        newShape[key] = value instanceof ZodNullable ? (value as ZodNullable<any>).nullish() : value;
    }
    return z.object(newShape as NullableToNullish<T>);
};


export const toBeDisconnectedSchema = z.object({
    toBeDisconnected: z.boolean().optional(),
});

export const withToBeDisconnected = <T extends ZodRawShape>(schema: ZodObject<T>) =>
    schema.extend(toBeDisconnectedSchema.shape);

export type WithToBeDisconnected<T> = T & z.infer<typeof toBeDisconnectedSchema>;


export const paginateSchema = <T extends ZodRawShape>(querySchema: ZodObject<T>) =>
    z.lazy(() => z.object({
        query: querySchema,
        options: exz.paginateOptions
    }));