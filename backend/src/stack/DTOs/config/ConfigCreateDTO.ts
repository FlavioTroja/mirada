import { z } from "zod";
import { UiScope, ValueType } from "@prisma/client";
import { ConfigSchema } from "@prisma-gen/zod";

export const ConfigCreateSchema = z.object({
    name: z.string(),
    scope: z.string(),
    uiScope: z.enum(UiScope),
    type: z.enum(ValueType),
    value: z.any().optional(),
});
export type ConfigCreateDTO = z.infer<typeof ConfigCreateSchema>;

export const EvaluatedConfigSchema = ConfigSchema.extend({ value: z.any() })
    .transform((data) => ({
        ...data,
        value: data[data.type]!
    }));

export type EvaluatedConfigDTO = z.infer<typeof EvaluatedConfigSchema>;